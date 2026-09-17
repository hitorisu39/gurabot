import sharp from "sharp";

import { AbstractService } from "@/core/framework/AbstractService";
import { HttpClient } from "@/http";
import { Import } from "@/core/decorators";
import { HttpService } from "@/modules/http/Http.service";

import { ScoreWithMaps } from "@domain/osu/Score.dto";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { ScorepostScaler } from "@domain/osu/utils/ScorepostScaler";
import { ScorepostResolution } from "@domain/osu/configs/Scorepost.config";

import { OsuMapsetDownloadService } from "../OsuMapsetDownload.service";

export class ScorepostBackgroundService extends AbstractService {
    @Import() declare private readonly httpService: HttpService;
    @Import() declare private readonly mapsetDownloadService: OsuMapsetDownloadService;

    declare private http: HttpClient;

    private readonly backgroundMissTtl = 5 * 60;
    private readonly maximumBackgroundBytes = 20 * 1024 * 1024;

    private readonly emptyBackgroundCache = new Map<ScorepostResolution, Promise<Buffer>>();

    public init(): void {
        this.http = this.httpService.create(this.logger, { name: "OsuScorepostBackground" });
    }

    public async load(score: ScoreWithMaps, scaler: ScorepostScaler): Promise<Buffer> {
        const difficultyBackground = await this.fetchBackground(
            MapFormatter.difficultyBackground(score.beatmap.id),
            `difficulty:${score.beatmap.id}`,
            scaler,
        );

        if (difficultyBackground) {
            return difficultyBackground;
        }

        const setBackground = await this.fetchBackground(
            MapFormatter.background(score.beatmapset.id),
            `mapset:${score.beatmapset.id}`,
            scaler,
        );

        if (setBackground) {
            return setBackground;
        }

        const extractedBackground = await this.mapsetDownloadService.background(score.beatmap.id, score.beatmapset.id);
        if (extractedBackground) {
            const processed = await this.processBackground(extractedBackground, scaler);
            if (processed) {
                return processed;
            }
        }

        return await this.getEmptyBackground(scaler);
    }

    private async fetchBackground(url: string, cacheID: string, scaler: ScorepostScaler): Promise<Buffer | null> {
        const failed = await this.cache.get("osu_scorepost_background_miss", cacheID);
        if (failed) {
            return null;
        }

        try {
            const source = await this.http.get<Buffer>(url, { responseType: "arraybuffer" });

            const processed = await this.processBackground(source, scaler);
            if (!processed) {
                await this.cacheBackgroundMiss(cacheID);
            }

            return processed;
        } catch {
            await this.cacheBackgroundMiss(cacheID);
            return null;
        }
    }

    private async cacheBackgroundMiss(cacheID: string): Promise<void> {
        await this.cache.set("osu_scorepost_background_miss", true, this.backgroundMissTtl, cacheID);
    }

    private async processBackground(source: Buffer, scaler: ScorepostScaler): Promise<Buffer | null> {
        if (!source.length) {
            return null;
        }

        if (source.length > this.maximumBackgroundBytes) {
            return null;
        }

        try {
            return await sharp(source, {
                limitInputPixels: 33_554_432,
            })
                .resize(scaler.width, scaler.height, {
                    fit: "cover",
                    position: "centre",
                })
                .jpeg({
                    quality: 90,
                })
                .toBuffer();
        } catch (error) {
            this.logger.warn(error, `Could not process scorepost background`);
            return null;
        }
    }

    private getEmptyBackground(scaler: ScorepostScaler): Promise<Buffer> {
        const resolution = scaler.resolution;

        let cached = this.emptyBackgroundCache.get(resolution);

        if (!cached) {
            cached = this.createEmptyBackground(scaler);
            this.emptyBackgroundCache.set(resolution, cached);
            cached.catch(() => {
                if (this.emptyBackgroundCache.get(resolution) === cached) {
                    this.emptyBackgroundCache.delete(resolution);
                }
            });
        }

        return cached;
    }

    private async createEmptyBackground(scaler: ScorepostScaler): Promise<Buffer> {
        return await sharp({
            create: {
                width: scaler.width,
                height: scaler.height,
                channels: 3,
                background: {
                    r: 0,
                    g: 0,
                    b: 0,
                },
            },
        })
            .jpeg({
                quality: 90,
            })
            .toBuffer();
    }
}
