import "reflect-metadata";
import axios, { AxiosInstance } from "axios";
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
import { TConfig, getConfig } from "@/env";
import { Logger } from "@/logger";
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

class FarmUpdater {
    private readonly base = "https://data.osu-pps.com";

    private readonly refreshTtl = 7 * 24 * 60 * 60 * 1_000;
    private readonly batchSize = 250;

    private readonly downloadTimeout = 10 * 60 * 1_000;

    private readonly logger: Logger;
    private readonly http: AxiosInstance;
    private readonly pool: Pool;

    private readonly prisma: PrismaClient;

    constructor(private readonly config: TConfig) {
        this.logger = new Logger(config);

        const dbUrl = this.createDatabaseUrl();

        this.pool = new Pool({
            connectionString: dbUrl.toString(),
            max: Math.max(1, Math.min(config.database.connection_limit, 4)),
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 5_000,
        });

        this.pool.on("error", (error) => {
            this.logger.error(error, "Unexpected PostgreSQL pool error");
        });

        const adapter = new PrismaPg(this.pool);
        this.prisma = new PrismaClient({
            adapter,
        });

        this.http = axios.create({
            baseURL: this.base,
            timeout: 10_000,
        });
    }

    public async run(options: IFarmUpdateOptions): Promise<void> {
        await this.prisma.$connect();
        this.logger.info("Connected to PostgreSQL.");

        try {
            for (const mode of farmModes) {
                if (options.mode && mode.path !== options.mode) {
                    continue;
                }

                await this.updateMode(mode, options.force);
            }
        } finally {
            await this.prisma.$disconnect();
        }
    }

    private async updateMode(mode: IFarmMode, force: boolean): Promise<void> {
        this.logger.info(`Checking farm data for ${mode.path}...`);

        const dataset = await this.prisma.farmDataset.findUnique(getFarmDatasetQuery(mode.id));
        if (!force && dataset && Date.now() - dataset.checkedAt.getTime() < this.refreshTtl) {
            const remaining = this.refreshTtl - (Date.now() - dataset.checkedAt.getTime());
            this.logger.info(
                `Skipping ${mode.path}. Farm data was checked recently. Next check in approximately ${this.formatDuration(remaining)}.`,
            );
            return;
        }

        const metadata = await this.getMetadata(mode.path);

        if (!force && dataset && dataset.snapshot.sourceUpdatedAt.getTime() >= metadata.lastUpdated.getTime()) {
            await this.prisma.farmDataset.update(getUpdateFarmCheckedAtQuery(mode.id, new Date()));
            this.logger.info(`${mode.path} is already up to date.`);
            return;
        }

        this.logger.info(`Updating ${mode.path}. Upstream timestamp: ${metadata.lastUpdated.toISOString()}.`);

        const files = await this.download(mode.path);
        await this.prisma.farmSnapshot.deleteMany(getDeleteInactiveFarmSnapshotsQuery(mode.id, dataset?.snapshotID));

        const snapshot = await this.prisma.farmSnapshot.create(
            getCreateFarmSnapshotQuery(mode.id, metadata.lastUpdated),
        );

        this.logger.info(`Created farm snapshot ${snapshot.id} for ${mode.path}.`);

        try {
            const mapsets = await this.importMapsets(snapshot.id, files.mapsets);
            const mapCount = await this.importMaps(snapshot.id, files.diffs, mapsets.bpm);

            if (mapsets.count === 0 || mapCount === 0) {
                throw new Error(`Farm import for ${mode.path} produced an empty dataset.`);
            }

            await this.prisma.$transaction([
                this.prisma.farmSnapshot.update(getFinalizeFarmSnapshotQuery(snapshot.id, mapsets.count, mapCount)),
                this.prisma.farmDataset.upsert(getActivateFarmDatasetQuery(mode.id, snapshot.id, new Date())),
            ]);

            this.logger.info(
                `Activated farm snapshot ${snapshot.id} for ${mode.path}. ${mapsets.count} mapsets. ${mapCount} map/mod combinations.`,
            );
        } catch (error) {
            this.logger.error(error, `Failed to import farm data for ${mode.path}.`);

            await Promise.allSettled([
                this.prisma.farmSnapshot.delete(getDeleteFarmSnapshotQuery(snapshot.id)),
                this.removeDownload(files),
            ]);

            throw error;
        }

        try {
            await this.commitFiles(mode.path, files);
        } catch (error) {
            this.logger.error(
                error,
                `Farm snapshot ${snapshot.id} was activated, but source files could not be committed to cache.`,
            );

            await this.removeDownload(files);
        }
    }

    private async getMetadata(mode: IFarmMode["path"]): Promise<FarmMetadataDto> {
        const response = await this.http.get<FarmMetadataDto>(`/metadata/${mode}/metadata.json`);
        const metadata = plainToInstance(FarmMetadataDto, response.data, {
            excludeExtraneousValues: true,
        });

        if (!metadata.lastUpdated || !Number.isFinite(metadata.lastUpdated.getTime())) {
            throw new Error(`osu!pps returned invalid metadata for ${mode}.`);
        }

        return metadata;
    }

    private async download(mode: IFarmMode["path"]): Promise<IFarmDownload> {
        const directory = this.directory(mode);

        await mkdir(directory, {
            recursive: true,
        });

        const id = uuidv7();
        const files: IFarmDownload = {
            mapsets: join(directory, `mapsets.${id}.csv.next`),
            diffs: join(directory, `diffs.${id}.csv.next`),
        };

        try {
            await this.downloadFile(`/maps/${mode}/mapsets.csv`, files.mapsets);
            await this.downloadFile(`/maps/${mode}/diffs.csv`, files.diffs);
            return files;
        } catch (error) {
            await this.removeDownload(files);
            throw error;
        }
    }

    private async downloadFile(path: string, destination: string): Promise<void> {
        const startedAt = Date.now();

        this.logger.info(`Downloading ${path}...`);

        const response = await this.http.get<Readable>(path, {
            responseType: "stream",
            timeout: this.downloadTimeout,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
        });

        await pipeline(response.data, createWriteStream(destination));
        this.logger.info(`Downloaded ${path} in ${this.formatDuration(Date.now() - startedAt)}.`);
    }

    private async importMapsets(snapshotID: number, path: string): Promise<IFarmMapsetImport> {
        this.logger.info(`Importing mapsets for snapshot ${snapshotID}...`);

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

            this.validateMapset(mapset);

            bpm.set(mapset.mapsetID, mapset.bpm);
            batch.push(mapset);

            if (batch.length >= this.batchSize) {
                count += await this.flushMapsets(snapshotID, batch);

                batch = [];
            }
        }

        count += await this.flushMapsets(snapshotID, batch);

        this.logger.info(`Imported ${count} mapsets for snapshot ${snapshotID}.`);

        return {
            count,
            bpm,
        };
    }

    private async flushMapsets(snapshotID: number, mapsets: ReadonlyArray<FarmMapsetCsvDto>): Promise<number> {
        if (!mapsets.length) {
            return 0;
        }

        const result = await this.prisma.farmMapset.createMany(getCreateFarmMapsetsQuery(snapshotID, mapsets));

        return result.count;
    }

    private async importMaps(snapshotID: number, path: string, bpm: ReadonlyMap<number, number>): Promise<number> {
        this.logger.info(`Importing maps for snapshot ${snapshotID}...`);

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

            this.validateMap(map);
            const mapBpm = bpm.get(map.mapsetID);

            if (mapBpm === undefined) {
                throw new Error(`Beatmap ${map.beatmapID} references unknown mapset ${map.mapsetID}.`);
            }

            batch.push(normalizeFarmMap(map, mapBpm));

            if (batch.length >= this.batchSize) {
                count += await this.flushMaps(snapshotID, batch);

                batch = [];

                if (count % 25_000 === 0) {
                    this.logger.info(`Imported ${count} maps for snapshot ${snapshotID}...`);
                }
            }
        }

        count += await this.flushMaps(snapshotID, batch);
        this.logger.info(`Imported ${count} maps for snapshot ${snapshotID}.`);

        return count;
    }

    private async flushMaps(snapshotID: number, maps: ReadonlyArray<IFarmMapImport>): Promise<number> {
        if (!maps.length) {
            return 0;
        }

        const result = await this.prisma.farmMap.createMany(getCreateFarmMapsQuery(snapshotID, maps));
        return result.count;
    }

    private async commitFiles(mode: IFarmMode["path"], files: IFarmDownload): Promise<void> {
        const directory = this.directory(mode);

        const mapsets = join(directory, "mapsets.csv");
        const diffs = join(directory, "diffs.csv");

        await rm(mapsets, {
            force: true,
        });

        await rename(files.mapsets, mapsets);

        await rm(diffs, {
            force: true,
        });

        await rename(files.diffs, diffs);
    }

    private async removeDownload(files: IFarmDownload): Promise<void> {
        await Promise.allSettled([
            rm(files.mapsets, {
                force: true,
            }),

            rm(files.diffs, {
                force: true,
            }),
        ]);
    }

    private validateMapset(mapset: FarmMapsetCsvDto): void {
        this.assertFinite(mapset.mapsetID, "mapset ID");
        this.assertFinite(mapset.bpm, "BPM");
    }

    private validateMap(map: FarmMapCsvDto): void {
        this.assertFinite(map.mods, "mods");
        this.assertFinite(map.beatmapID, "beatmap ID");
        this.assertFinite(map.mapsetID, "mapset ID");
        this.assertFinite(map.farmValue, "farm value");
        this.assertFinite(map.adjusted, "adjusted value");
        this.assertFinite(map.length, "length");
        this.assertFinite(map.stars, "stars");
        this.assertFinite(map.passCount, "pass count");
        this.assertFinite(map.ageHours, "age");
        this.assertFinite(map.rankedHours, "ranked timestamp");
        this.assertFinite(map.ar, "AR");
        this.assertFinite(map.cs, "CS");
        this.assertFinite(map.accuracy, "OD");
        this.assertFinite(map.drain, "HP");

        if (map.pp !== undefined) {
            this.assertFinite(map.pp, "PP");
        }
    }

    private assertFinite(value: number, name: string): void {
        if (!Number.isFinite(value)) {
            throw new Error(`osu!pps returned invalid ${name}.`);
        }
    }

    private createDatabaseUrl(): URL {
        const { host, port, name, user, password } = this.config.database;
        const url = new URL(`postgresql://${host}:${port}/${encodeURIComponent(name)}`);
        url.username = user;
        url.password = password;
        return url;
    }

    private directory(mode: IFarmMode["path"]): string {
        return join(process.cwd(), this.config.app.cache, "farm", mode);
    }

    private formatDuration(duration: number): string {
        if (duration < 1_000) {
            return `${duration}ms`;
        }

        if (duration < 60_000) {
            return `${(duration / 1_000).toFixed(1)}s`;
        }

        return `${(duration / 60_000).toFixed(1)}m`;
    }
}

const parseOptions = (): IFarmUpdateOptions => {
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
};

const bootstrap = async (): Promise<void> => {
    const config = getConfig();
    const updater = new FarmUpdater(config);
    await updater.run(parseOptions());
};

bootstrap().catch((error) => {
    console.error("Farm update failed.", error);
    process.exitCode = 1;
});
