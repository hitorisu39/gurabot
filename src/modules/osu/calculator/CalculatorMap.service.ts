import path from "path";
import fs from "fs";

import { AbstractService } from "@/core/framework/AbstractService";
import { HttpClient } from "@/http";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { wait } from "@domain/utils/utils";
import { osuBaseUrl } from "@domain/osu/configs/Osu.config";

export class CalculatorMapService extends AbstractService {
    declare private http: HttpClient;
    declare private mapPath: string;

    private readonly workers: number = 4;
    private readonly maxRetries: number = 3;
    private readonly retryDelay: number = 500;

    private readonly activeDownloads: Map<number, Promise<void>> = new Map();

    public async init(): Promise<void> {
        this.http = new HttpClient(this.logger, { baseURL: osuBaseUrl });
        this.mapPath = path.join(process.cwd(), this.config.app.cache, "beatmaps");

        if (!fs.existsSync(this.mapPath)) {
            fs.mkdirSync(this.mapPath, { recursive: true });
        }
    }

    public getPath(beatmapID: number): string {
        return path.join(this.mapPath, `${beatmapID}.osu`)
    }

    public valid(beatmapID: number): boolean {
        const filePath = this.getPath(beatmapID);
        if (!fs.existsSync(filePath)) return false;

        try {
            const fd = fs.openSync(filePath, "r");
            const buffer = Buffer.alloc(50);
            const bytesRead = fs.readSync(fd, buffer, 0, 50, 0);
            fs.closeSync(fd);

            const header = buffer.toString("utf8", 0, bytesRead);
            return header.includes("osu file format v");
        } catch {
            return false;
        }
    }

    public async download(beatmapID: number): Promise<void> {
        if (this.valid(beatmapID))
            return;

        if (this.activeDownloads.has(beatmapID)) {
            this.logger.debug(`Map ${beatmapID} is already downloading. Waiting...`);
            return this.activeDownloads.get(beatmapID)!;
        }

        const downloadTask = (async () => {
            let attempt = 1;

            while (attempt <= this.maxRetries) {
                try {
                    const data = await this.http.get<string>(`/osu/${beatmapID}`);
                    if (!data || !data.includes("osu file format"))
                        throw new Exception(EApplicationError.INTERNAL_ERROR, "Downloaded data is not a valid file.");

                    const destination = this.getPath(beatmapID);
                    const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;

                    try {
                        fs.writeFileSync(temporary, data, {
                            encoding: "utf8",
                        });

                        fs.renameSync(temporary, destination);
                    } finally {
                        if (fs.existsSync(temporary)) {
                            fs.unlinkSync(temporary);
                        }
                    }
                    return;
                } catch (error) {
                    this.logger.warn(error, `Attempt ${attempt}/${this.maxRetries} failed for map ${beatmapID}`);

                    if (attempt >= this.maxRetries)
                        throw new Exception(EApplicationError.INTERNAL_ERROR, `Failed to download beatmap ${beatmapID} after ${this.maxRetries} attempts.`);

                    attempt++;
                    await wait(this.retryDelay);
                }
            }
        })();

        this.activeDownloads.set(beatmapID, downloadTask);

        try {
            await downloadTask;
        } finally {
            this.activeDownloads.delete(beatmapID);
        }
    }

    public async downloadMany(beatmapIDs: ReadonlyArray<number>): Promise<void> {
        const queue = [...new Set(beatmapIDs)];
        const workers: Array<Promise<void>> = [];

        const worker = async () => {
            while (queue.length > 0) {
                const id = queue.shift()!;
                await this.download(id);
            }
        };

        for (let i = 0; i < this.workers; i++) {
            workers.push(worker());
        }

        await Promise.all(workers);
    }

    public delete(beatmapID: number): void {
        const filePath = this.getPath(beatmapID);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}