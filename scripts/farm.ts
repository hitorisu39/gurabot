import "reflect-metadata";
import axios from "axios";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@generated/prisma/client";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { parse } from "csv-parse";
import { plainToInstance } from "class-transformer";
import { FarmMapCsvDto, FarmMapsetCsvDto, FarmMetadataDto } from "@domain/farm/Farm.dto";
import { IFarmMapImport } from "@domain/farm/Farm.types";
import { normalizeFarmMap } from "@domain/farm/utils/Farm.utils";
import { getConfig } from "@/env";
import {
    getActivateFarmDatasetQuery,
    getCreateFarmMapsQuery,
    getCreateFarmMapsetsQuery,
    getCreateFarmSnapshotQuery,
    getDeleteFarmSnapshotQuery,
    getDeleteInactiveFarmSnapshotsQuery,
    getFarmDatasetQuery,
    getFinalizeFarmSnapshotQuery,
    getUpdateFarmCheckedAtQuery,
} from "@/modules/farm/queries/Farm.queries";
import { uuidv7 } from "uuidv7";

interface IFarmMode {
    id: number;
    path: "osu" | "taiko" | "fruits" | "mania";
}

interface IFarmUpdateOptions {
    force: boolean;
    mode?: IFarmMode["path"];
}

interface IFarmDownload {
    mapsets: string;
    diffs: string;
}

interface IFarmMapsetImport {
    count: number;
    bpm: Map<number, number>;
}

const farmModes: ReadonlyArray<IFarmMode> = [
    {
        id: 0,
        path: "osu",
    },
    {
        id: 1,
        path: "taiko",
    },
    {
        id: 2,
        path: "fruits",
    },
    {
        id: 3,
        path: "mania",
    },
];

const base = "https://data.osu-pps.com";
const refreshTtl = 7 * 24 * 60 * 60 * 1_000;
const batchSize = 250;
const downloadTimeout = 10 * 60 * 1_000;

const config = getConfig();
const dbUrl = createDatabaseUrl();

const pool = new Pool({
    connectionString: dbUrl.toString(),
    max: Math.max(1, Math.min(config.database.connection_limit, 4)),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
});

pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error", error);
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
    adapter,
});

const http = axios.create({
    baseURL: base,
    timeout: 10_000,
});

//#region Update

async function run(options: IFarmUpdateOptions): Promise<void> {
    await prisma.$connect();
    console.log("Connected to PostgreSQL.");

    try {
        for (const mode of farmModes) {
            if (options.mode && mode.path !== options.mode) {
                continue;
            }

            await updateMode(mode, options.force);
        }
    } finally {
        await prisma.$disconnect();
    }
}

async function updateMode(mode: IFarmMode, force: boolean): Promise<void> {
    console.log(`Checking farm data for ${mode.path}...`);

    const dataset = await prisma.farmDataset.findUnique(getFarmDatasetQuery(mode.id));
    if (!force && dataset && Date.now() - dataset.checkedAt.getTime() < refreshTtl) {
        const remaining = refreshTtl - (Date.now() - dataset.checkedAt.getTime());
        console.log(
            `Skipping ${mode.path}. Farm data was checked recently. Next check in approximately ${formatDuration(remaining)}.`,
        );
        return;
    }

    const metadata = await getMetadata(mode.path);

    if (!force && dataset && dataset.snapshot.sourceUpdatedAt.getTime() >= metadata.lastUpdated.getTime()) {
        await prisma.farmDataset.update(getUpdateFarmCheckedAtQuery(mode.id, new Date()));
        console.log(`${mode.path} is already up to date.`);
        return;
    }

    console.log(`Updating ${mode.path}. Upstream timestamp: ${metadata.lastUpdated.toISOString()}.`);

    const files = await download(mode.path);
    await prisma.farmSnapshot.deleteMany(getDeleteInactiveFarmSnapshotsQuery(mode.id, dataset?.snapshotID));

    const snapshot = await prisma.farmSnapshot.create(getCreateFarmSnapshotQuery(mode.id, metadata.lastUpdated));

    console.log(`Created farm snapshot ${snapshot.id} for ${mode.path}.`);

    try {
        const mapsets = await importMapsets(snapshot.id, files.mapsets);
        const mapCount = await importMaps(snapshot.id, files.diffs, mapsets.bpm);

        if (mapsets.count === 0 || mapCount === 0) {
            throw new Error(`Farm import for ${mode.path} produced an empty dataset.`);
        }

        await prisma.$transaction([
            prisma.farmSnapshot.update(getFinalizeFarmSnapshotQuery(snapshot.id, mapsets.count, mapCount)),
            prisma.farmDataset.upsert(getActivateFarmDatasetQuery(mode.id, snapshot.id, new Date())),
        ]);

        console.log(
            `Activated farm snapshot ${snapshot.id} for ${mode.path}. ${mapsets.count} mapsets. ${mapCount} map/mod combinations.`,
        );
    } catch (error) {
        console.error(`Failed to import farm data for ${mode.path}.`, error);

        await Promise.allSettled([
            prisma.farmSnapshot.delete(getDeleteFarmSnapshotQuery(snapshot.id)),
            removeDownload(files),
        ]);

        throw error;
    }

    try {
        await commitFiles(mode.path, files);
    } catch (error) {
        console.error(
            `Farm snapshot ${snapshot.id} was activated, but source files could not be committed to cache.`,
            error,
        );

        await removeDownload(files);
    }
}

async function getMetadata(mode: IFarmMode["path"]): Promise<FarmMetadataDto> {
    const response = await http.get<FarmMetadataDto>(`/metadata/${mode}/metadata.json`);
    const metadata = plainToInstance(FarmMetadataDto, response.data, {
        excludeExtraneousValues: true,
    });

    if (!metadata.lastUpdated || !Number.isFinite(metadata.lastUpdated.getTime())) {
        throw new Error(`osu-pps returned invalid metadata for ${mode}.`);
    }

    return metadata;
}

//#endregion

//#region Download

async function download(mode: IFarmMode["path"]): Promise<IFarmDownload> {
    const directory = getFarmDirectory(mode);

    await mkdir(directory, {
        recursive: true,
    });

    const id = uuidv7();
    const files: IFarmDownload = {
        mapsets: join(directory, `mapsets.${id}.csv.next`),
        diffs: join(directory, `diffs.${id}.csv.next`),
    };

    try {
        await downloadFile(`/maps/${mode}/mapsets.csv`, files.mapsets);
        await downloadFile(`/maps/${mode}/diffs.csv`, files.diffs);
        return files;
    } catch (error) {
        await removeDownload(files);
        throw error;
    }
}

async function downloadFile(path: string, destination: string): Promise<void> {
    const startedAt = Date.now();

    console.log(`Downloading ${path}...`);

    const response = await http.get<Readable>(path, {
        responseType: "stream",
        timeout: downloadTimeout,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
    });

    await pipeline(response.data, createWriteStream(destination));
    console.log(`Downloaded ${path} in ${formatDuration(Date.now() - startedAt)}.`);
}

//#endregion

//#region Import

async function importMapsets(snapshotID: number, path: string): Promise<IFarmMapsetImport> {
    console.log(`Importing mapsets for snapshot ${snapshotID}...`);

    const stream = createReadStream(path).pipe(
        parse({
            columns: true,
            bom: true,
            skip_empty_lines: true,
        }),
    );

    const bpm = new Map<number, number>();
    let batch: Array<FarmMapsetCsvDto> = [];

    let count = 0;

    for await (const row of stream) {
        const mapset = plainToInstance(FarmMapsetCsvDto, row, {
            excludeExtraneousValues: true,
        });

        validateMapset(mapset);

        bpm.set(mapset.mapsetID, mapset.bpm);
        batch.push(mapset);

        if (batch.length >= batchSize) {
            count += await flushMapsets(snapshotID, batch);

            batch = [];
        }
    }

    count += await flushMapsets(snapshotID, batch);

    console.log(`Imported ${count} mapsets for snapshot ${snapshotID}.`);

    return {
        count,
        bpm,
    };
}

async function flushMapsets(snapshotID: number, mapsets: ReadonlyArray<FarmMapsetCsvDto>): Promise<number> {
    if (!mapsets.length) {
        return 0;
    }

    const result = await prisma.farmMapset.createMany(getCreateFarmMapsetsQuery(snapshotID, mapsets));
    return result.count;
}

async function importMaps(snapshotID: number, path: string, bpm: ReadonlyMap<number, number>): Promise<number> {
    console.log(`Importing maps for snapshot ${snapshotID}...`);

    const stream = createReadStream(path).pipe(
        parse({
            columns: true,
            bom: true,
            skip_empty_lines: true,
        }),
    );

    let batch: Array<IFarmMapImport> = [];
    let count = 0;

    for await (const row of stream) {
        const map = plainToInstance(FarmMapCsvDto, row, {
            excludeExtraneousValues: true,
        });

        validateMap(map);
        const mapBpm = bpm.get(map.mapsetID);

        if (mapBpm === undefined) {
            throw new Error(`Beatmap ${map.beatmapID} references unknown mapset ${map.mapsetID}.`);
        }

        batch.push(normalizeFarmMap(map, mapBpm));

        if (batch.length >= batchSize) {
            count += await flushMaps(snapshotID, batch);

            batch = [];

            if (count % 25_000 === 0) {
                console.log(`Imported ${count} maps for snapshot ${snapshotID}...`);
            }
        }
    }

    count += await flushMaps(snapshotID, batch);
    console.log(`Imported ${count} maps for snapshot ${snapshotID}.`);

    return count;
}

async function flushMaps(snapshotID: number, maps: ReadonlyArray<IFarmMapImport>): Promise<number> {
    if (!maps.length) {
        return 0;
    }

    const result = await prisma.farmMap.createMany(getCreateFarmMapsQuery(snapshotID, maps));
    return result.count;
}

//#endregion

//#region Files

async function commitFiles(mode: IFarmMode["path"], files: IFarmDownload): Promise<void> {
    const directory = getFarmDirectory(mode);

    const mapsets = join(directory, "mapsets.csv");
    const diffs = join(directory, "diffs.csv");

    await rm(mapsets, { force: true });
    await rename(files.mapsets, mapsets);

    await rm(diffs, { force: true });
    await rename(files.diffs, diffs);
}

async function removeDownload(files: IFarmDownload): Promise<void> {
    await Promise.allSettled([
        rm(files.mapsets, {
            force: true,
        }),

        rm(files.diffs, {
            force: true,
        }),
    ]);
}

//#endregion

//#region Validation

function validateMapset(mapset: FarmMapsetCsvDto): void {
    assertFinite(mapset.mapsetID, "mapset ID");
    assertFinite(mapset.bpm, "BPM");
}

function validateMap(map: FarmMapCsvDto): void {
    assertFinite(map.mods, "mods");
    assertFinite(map.beatmapID, "beatmap ID");
    assertFinite(map.mapsetID, "mapset ID");
    assertFinite(map.farmValue, "farm value");
    assertFinite(map.adjusted, "adjusted value");
    assertFinite(map.length, "length");
    assertFinite(map.stars, "stars");
    assertFinite(map.passCount, "pass count");
    assertFinite(map.ageHours, "age");
    assertFinite(map.rankedHours, "ranked timestamp");
    assertFinite(map.ar, "AR");
    assertFinite(map.cs, "CS");
    assertFinite(map.accuracy, "OD");
    assertFinite(map.drain, "HP");

    if (map.pp !== undefined) {
        assertFinite(map.pp, "PP");
    }
}

function assertFinite(value: number, name: string): void {
    if (!Number.isFinite(value)) {
        throw new Error(`osu-pps returned invalid ${name}.`);
    }
}

//#endregion

//#region Helpers

function createDatabaseUrl(): URL {
    const { host, port, name, user, password } = config.database;
    const url = new URL(`postgresql://${host}:${port}/${encodeURIComponent(name)}`);
    url.username = user;
    url.password = password;
    return url;
}

function getFarmDirectory(mode: IFarmMode["path"]): string {
    return join(process.cwd(), config.app.cache, "farm", mode);
}

function formatDuration(duration: number): string {
    if (duration < 1_000) {
        return `${duration}ms`;
    }

    if (duration < 60_000) {
        return `${(duration / 1_000).toFixed(1)}s`;
    }

    return `${(duration / 60_000).toFixed(1)}m`;
}

function parseOptions(): IFarmUpdateOptions {
    const force = process.argv.includes("--force");

    const modeArgument = process.argv.find((argument) => argument.startsWith("--mode="));
    const mode = modeArgument?.slice("--mode=".length);

    if (mode !== undefined && !farmModes.some((entry) => entry.path === mode)) {
        throw new Error(`Unknown farm mode "${mode}". Expected ${farmModes.join(", ")}.`);
    }

    return {
        force,
        mode: mode as IFarmMode["path"] | undefined,
    };
}

//#endregion

run(parseOptions()).catch((error) => {
    console.error("Farm update failed.", error);
    process.exitCode = 1;
});
