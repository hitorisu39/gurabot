import sharp from "sharp";
import { AbstractService } from "@/core/framework/AbstractService";
import { HttpClient } from "@/http";
import { ScoreWithMaps } from "@domain/osu/Score.dto";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { scorepostDimensions } from "@domain/osu/configs/Scorepost.config";
import { Import } from "@/core/decorators";
import { OsuMapsetDownloadService } from "../OsuMapsetDownload.service";

export class ScorepostBackgroundService extends AbstractService {
    @Import() declare private readonly mapsetDownloadService: OsuMapsetDownloadService;

    declare private http: HttpClient;

    private readonly backgroundMissTtl = 5 * 60;
    private readonly maximumBackgroundBytes = 20 * 1024 * 1024;

    private emptyBackground?: Promise<Buffer>;

    public init(): void {
        this.http = new HttpClient(this.logger, { name: "OsuScorepostBackground" });
    }

    public async load(score: ScoreWithMaps): Promise<Buffer> {
        const difficultyBackground = await this.fetchBackground(
            MapFormatter.difficultyBackground(score.beatmap.id),
            `difficulty:${score.beatmap.id}`,
        );

        if (difficultyBackground) {
            return difficultyBackground;
        }

        const setBackground = await this.fetchBackground(
            MapFormatter.background(score.beatmapset.id),
            `mapset:${score.beatmapset.id}`,
        );

        if (setBackground) {
            return setBackground;
        }

        const extractedBackground = await this.mapsetDownloadService.background(score.beatmap.id, score.beatmapset.id);
        if (extractedBackground) {
            const processed = await this.processBackground(extractedBackground);
            if (processed) {
                return processed;
            }
        }

        return await this.getEmptyBackground();
    }

    private async fetchBackground(url: string, cacheID: string): Promise<Buffer | null> {
        const failed = await this.cache.get("osu_scorepost_background_miss", cacheID);
        if (failed) {
            return null;
        }

        try {
            const source = await this.http.get<Buffer>(url, {
                responseType: "arraybuffer",
            });

            const processed = await this.processBackground(source);
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

    private async processBackground(source: Buffer): Promise<Buffer | null> {
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
                .resize(scorepostDimensions.width, scorepostDimensions.height, {
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

    private getEmptyBackground(): Promise<Buffer> {
        if (!this.emptyBackground) {
            this.emptyBackground = this.createEmptyBackground();

            this.emptyBackground.catch(() => {
                this.emptyBackground = undefined;
            });
        }

        return this.emptyBackground;
    }

    private async createEmptyBackground(): Promise<Buffer> {
        return await sharp({
            create: {
                width: scorepostDimensions.width,
                height: scorepostDimensions.height,
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
