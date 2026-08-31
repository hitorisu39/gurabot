import path from "path";
import { createWriteStream } from "fs";
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "fs/promises";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { Open, type File as ZipFile } from "unzipper";
import { AbstractService } from "@/core/framework/AbstractService";
import { HttpClient } from "@/http";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { osuMapsetDownloads } from "@domain/osu/configs/Osu.config";
import { isValidNumber, wait } from "@domain/utils/utils";
import { uuidv7 } from "uuidv7";

interface IBeatmapBackgroundReference {
    beatmapID: number;
    backgroundPath: string;
}

export class OsuMapsetDownloadService extends AbstractService {
    declare private http: HttpClient;

    declare private mapsetsDirectory: string;
    declare private backgroundsDirectory: string;

    /**
     * Extracted backgrounds live for 10 minutes.
     */
    private readonly backgroundTtl = 10 * 60 * 1_000;

    /**
     * Distributed extraction lease.
     *
     * This is deliberately much shorter than the background TTL.
     * Other processes poll for either the requested background or the
     * completed-mapset marker while another process owns the lease.
     */
    private readonly extractionLease = 2 * 60 * 1_000;

    private readonly lockPollInterval = 250;

    /**
     * Same-process deduplication.
     */
    private readonly activeExtractions = new Map<number, Promise<void>>();

    private cleanupRunning = false;

    public async init(): Promise<void> {
        const cache = path.join(process.cwd(), this.config.app.cache);

        this.mapsetsDirectory = path.join(cache, "mapsets");
        this.backgroundsDirectory = path.join(cache, "backgrounds");

        await Promise.all([
            mkdir(this.mapsetsDirectory, { recursive: true }),
            mkdir(this.backgroundsDirectory, { recursive: true }),
        ]);

        this.http = new HttpClient(this.logger, { name: "OsuMapsetDownload" });

        await this.clearMapsetDirectory();
        await this.cleanupExpiredBackgrounds();

        const cleanup = setInterval(() => void this.cleanupExpiredBackgrounds(), 60_000);
        cleanup.unref();
    }

    /**
     * Returns the exact background for a difficulty, extracting its mapset
     * when necessary.
     *
     * null means the mapset was processed successfully but no usable
     * background was found for this difficulty, or all download sources failed.
     */
    public async background(beatmapID: number, mapsetID: number): Promise<Buffer | null> {
        const cached = await this.readCachedBackground(beatmapID);

        if (cached) {
            return cached;
        }

        /*
         * If this mapset was already processed recently, don't redownload a
         * potentially huge .osz just because this particular difficulty has
         * no background.
         */
        if (await this.hasFreshExtractionMarker(mapsetID)) {
            return null;
        }

        try {
            await this.ensureExtracted(mapsetID, beatmapID);
        } catch (error) {
            this.logger.warn(error, `Could not prepare mapset ${mapsetID} backgrounds.`);
            return null;
        }

        return await this.readCachedBackground(beatmapID);
    }

    //#region Extraction locking

    private async ensureExtracted(mapsetID: number, requestedBeatmapID: number): Promise<void> {
        const active = this.activeExtractions.get(mapsetID);

        if (active) {
            return await active;
        }

        const task = this.extractWithLease(mapsetID, requestedBeatmapID);
        this.activeExtractions.set(mapsetID, task);

        try {
            await task;
        } finally {
            this.activeExtractions.delete(mapsetID);
        }
    }

    private async extractWithLease(mapsetID: number, requestedBeatmapID: number): Promise<void> {
        const leaseKey = `osu:mapset-download:${mapsetID}`;

        while (true) {
            /*
             * Another process may have finished while we were waiting.
             */
            if (await this.hasFreshBackground(requestedBeatmapID)) {
                return;
            }

            if (await this.hasFreshExtractionMarker(mapsetID)) {
                return;
            }

            const acquired = await this.cache.reserveLease(leaseKey, this.extractionLease);
            if (acquired) {
                break;
            }

            await wait(this.lockPollInterval);
        }

        /*
         * Check one more time after obtaining the lease. This covers the race
         * where another worker finished immediately before our acquisition.
         */
        if (await this.hasFreshBackground(requestedBeatmapID)) {
            return;
        }

        if (await this.hasFreshExtractionMarker(mapsetID)) {
            return;
        }

        await this.downloadAndExtract(mapsetID);
    }

    //#endregion

    //#region Download

    private async downloadAndExtract(mapsetID: number): Promise<void> {
        const sources = osuMapsetDownloads.filter((source) => source.downloadable);

        if (!sources.length) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "No downloadable osu! mapset sources are configured.",
            );
        }

        const archivePath = this.getMapsetPath(mapsetID);

        for (const source of sources) {
            const url = `${source.base}/${mapsetID}`;

            try {
                await rm(archivePath, { force: true });

                this.logger.debug(`Downloading mapset ${mapsetID} from ${source.name}.`);

                await this.downloadArchive(url, archivePath);
                const extracted = await this.extractBackgrounds(mapsetID, archivePath);
                await this.createExtractionMarker(mapsetID);

                this.logger.debug(
                    `Extracted ${extracted} difficulty background(s) from mapset ${mapsetID} using ${source.name}.`,
                );

                return;
            } catch (error) {
                this.logger.warn(error, `Failed to process mapset ${mapsetID} from ${source.name}`);
            } finally {
                await rm(archivePath, { force: true }).catch(() => undefined);
            }
        }

        throw new Exception(
            EApplicationError.INTERNAL_ERROR,
            `Failed to download mapset ${mapsetID} from every configured source.`,
        );
    }

    private async downloadArchive(url: string, destination: string): Promise<void> {
        const response = await this.http.getResponse<Readable>(url, {
            responseType: "stream",
        });

        await pipeline(response.data, createWriteStream(destination));
    }

    //#endregion

    //#region ZIP parsing

    private async extractBackgrounds(mapsetID: number, archivePath: string): Promise<number> {
        const directory = await Open.file(archivePath);
        const osuFiles = directory.files.filter(
            (file) => file.type === "File" && file.path.toLowerCase().endsWith(".osu"),
        );

        if (!osuFiles.length) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                `Downloaded mapset ${mapsetID} contains no .osu files.`,
            );
        }

        const references: Array<IBeatmapBackgroundReference> = [];

        for (const osuFile of osuFiles) {
            const reference = await this.parseBeatmapBackground(osuFile);

            if (reference) {
                references.push(reference);
            }
        }

        if (!references.length) {
            this.logger.warn(`No difficulty backgrounds were referenced by mapset ${mapsetID}.`);
            return 0;
        }

        const filesByPath = new Map<string, ZipFile>();
        for (const file of directory.files) {
            if (file.type !== "File") {
                continue;
            }

            filesByPath.set(this.normalizeArchivePath(file.path), file);
        }

        /*
         * Multiple difficulties commonly reference exactly the same image.
         * Extract it once, then copy the resulting file for each beatmap ID.
         */
        const beatmapsByBackground = new Map<string, Set<number>>();

        for (const reference of references) {
            let beatmapIDs = beatmapsByBackground.get(reference.backgroundPath);

            if (!beatmapIDs) {
                beatmapIDs = new Set<number>();
                beatmapsByBackground.set(reference.backgroundPath, beatmapIDs);
            }

            beatmapIDs.add(reference.beatmapID);
        }

        let extracted = 0;

        for (const [backgroundPath, beatmapIDs] of beatmapsByBackground) {
            const entry = filesByPath.get(backgroundPath);

            if (!entry) {
                this.logger.debug(`Mapset ${mapsetID} references missing background "${backgroundPath}".`);
                continue;
            }

            await this.extractBackgroundEntry(entry, beatmapIDs);
            extracted += beatmapIDs.size;
        }

        return extracted;
    }

    private async parseBeatmapBackground(osuFile: ZipFile): Promise<IBeatmapBackgroundReference | null> {
        const buffer = await osuFile.buffer();
        const contents = buffer.toString("utf8").replace(/^\uFEFF/, "");
        const beatmapIDMatch = /^BeatmapID\s*:\s*(\d+)\s*$/m.exec(contents);

        if (!beatmapIDMatch) {
            return null;
        }

        const beatmapID = Number(beatmapIDMatch[1]);
        if (!isValidNumber(beatmapID) || beatmapID <= 0) {
            return null;
        }

        const events = this.getSection(contents, "Events");
        if (!events) {
            return null;
        }

        /*
         * background event
         * 0,0,"background.jpg",0,0
         */
        const backgroundMatch = /^\s*0\s*,\s*0\s*,\s*(?:"([^"]+)"|([^,\r\n]+))/m.exec(events);
        const backgroundName = backgroundMatch?.[1]?.trim() ?? backgroundMatch?.[2]?.trim();

        if (!backgroundName) {
            return null;
        }

        return {
            beatmapID,
            backgroundPath: this.resolveBackgroundPath(osuFile.path, backgroundName),
        };
    }

    private getSection(contents: string, name: string): string | null {
        const header = `[${name}]`;
        const start = contents.indexOf(header);

        if (start === -1) {
            return null;
        }

        const bodyStart = start + header.length;
        const nextSection = contents.indexOf("\n[", bodyStart);

        return nextSection === -1 ? contents.slice(bodyStart) : contents.slice(bodyStart, nextSection);
    }

    private resolveBackgroundPath(osuFilePath: string, backgroundName: string): string {
        const normalizedOsuPath = osuFilePath.replaceAll("\\", "/");
        const normalizedBackgroundName = backgroundName.replaceAll("\\", "/");
        const directory = path.posix.dirname(normalizedOsuPath);
        return this.normalizeArchivePath(path.posix.join(directory, normalizedBackgroundName));
    }

    private normalizeArchivePath(value: string): string {
        return value
            .replaceAll("\\", "/")
            .replace(/^\.\/+/, "")
            .toLowerCase();
    }

    //#endregion

    //#region Background extraction

    private async extractBackgroundEntry(entry: ZipFile, beatmapIDs: ReadonlySet<number>): Promise<void> {
        const extractedPath = path.join(this.mapsetsDirectory, `background-${uuidv7()}.tmp`);

        try {
            await pipeline(entry.stream(), createWriteStream(extractedPath));
            for (const beatmapID of beatmapIDs) {
                await this.storeBackground(extractedPath, beatmapID);
            }
        } finally {
            await rm(extractedPath, {
                force: true,
            }).catch(() => undefined);
        }
    }

    private async storeBackground(source: string, beatmapID: number): Promise<void> {
        const destination = this.getBackgroundPath(beatmapID);
        const temporary = `${destination}.${uuidv7()}.tmp`;

        try {
            await copyFile(source, temporary);
            await rename(temporary, destination);
        } finally {
            await rm(temporary, { force: true }).catch(() => undefined);
        }
    }

    //#endregion

    //#region Cache

    private async readCachedBackground(beatmapID: number): Promise<Buffer | null> {
        const filePath = this.getBackgroundPath(beatmapID);
        if (!(await this.isFreshCacheFile(filePath))) {
            return null;
        }

        try {
            return await readFile(filePath);
        } catch (error) {
            if (this.isMissingFileError(error)) {
                return null;
            }

            throw error;
        }
    }

    private async hasFreshBackground(beatmapID: number): Promise<boolean> {
        return await this.isFreshCacheFile(this.getBackgroundPath(beatmapID));
    }

    private async hasFreshExtractionMarker(mapsetID: number): Promise<boolean> {
        return await this.isFreshCacheFile(this.getExtractionMarkerPath(mapsetID));
    }

    private async createExtractionMarker(mapsetID: number): Promise<void> {
        await writeFile(this.getExtractionMarkerPath(mapsetID), "", "utf8");
    }

    private async isFreshCacheFile(filePath: string): Promise<boolean> {
        try {
            const metadata = await stat(filePath);
            if (!metadata.isFile()) {
                return false;
            }

            const expired = Date.now() - metadata.mtimeMs >= this.backgroundTtl;
            if (!expired) {
                return true;
            }

            await rm(filePath, { force: true });
            return false;
        } catch (error) {
            if (this.isMissingFileError(error)) {
                return false;
            }

            throw error;
        }
    }

    private async cleanupExpiredBackgrounds(): Promise<void> {
        if (this.cleanupRunning) {
            return;
        }

        this.cleanupRunning = true;

        try {
            const entries = await readdir(this.backgroundsDirectory, { withFileTypes: true });

            for (const entry of entries) {
                if (!entry.isFile()) {
                    continue;
                }

                const filePath = path.join(this.backgroundsDirectory, entry.name);
                await this.isFreshCacheFile(filePath).catch((error: unknown) => {
                    this.logger.warn(error, `Could not inspect cached background ${filePath}`);
                });
            }
        } finally {
            this.cleanupRunning = false;
        }
    }

    private async clearMapsetDirectory(): Promise<void> {
        const entries = await readdir(this.mapsetsDirectory, {
            withFileTypes: true,
        });

        for (const entry of entries) {
            if (!entry.isFile()) {
                continue;
            }

            await rm(path.join(this.mapsetsDirectory, entry.name), {
                force: true,
            });
        }
    }

    //#endregion

    //#region Paths / errors

    private getMapsetPath(mapsetID: number): string {
        return path.join(this.mapsetsDirectory, `${mapsetID}.osz`);
    }

    private getBackgroundPath(beatmapID: number): string {
        return path.join(this.backgroundsDirectory, String(beatmapID));
    }

    private getExtractionMarkerPath(mapsetID: number): string {
        return path.join(this.backgroundsDirectory, `.mapset-${mapsetID}`);
    }

    private isMissingFileError(error: unknown): boolean {
        return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
    }

    //#endregion
}
