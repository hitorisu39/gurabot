import { readFile } from "node:fs/promises";
import path from "node:path";
import { CanvasRenderingContext2D, createCanvas, registerFont } from "canvas";
import sharp, { type OverlayOptions } from "sharp";
import { Import } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import {
    scorepostDimensions,
    stableScorepostLayout,
    stableScorepostModAssets,
} from "@domain/osu/configs/Scorepost.config";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ScorepostViewDto } from "@domain/osu/views/Scorepost.view";
import { ParsedMod } from "@generated/adapter/mods";
import { ScorepostBackgroundService } from "./ScorepostBackground.service";
import { ScorepostFormatter } from "@domain/osu/formatters/Scorepost.formatter";

interface ICachedScorepostAsset {
    buffer: Buffer;
    width: number;
    height: number;
}

export class StableScorepostRendererService extends AbstractService {
    @Import() declare private readonly backgroundService: ScorepostBackgroundService;

    declare private assets: string;

    private readonly assetCache = new Map<string, Promise<ICachedScorepostAsset>>();
    private readonly resizedAssetCache = new Map<string, Promise<Buffer>>();

    private staticOverlay?: Promise<Buffer>;

    public async init(): Promise<void> {
        const resources = path.join(process.cwd(), this.config.app.resources);
        this.assets = path.join(resources, "scorepost", "stable");

        const allerPath = path.join(resources, "fonts", "Aller_Std_Lt.ttf");
        const robotoSlabPath = path.join(resources, "fonts", "RobotoSlab-Regular.ttf");

        registerFont(allerPath, {
            family: "ScorepostAller",
            weight: "normal",
            style: "normal",
        });

        registerFont(robotoSlabPath, {
            family: "ScorepostRobotoSlab",
            weight: "normal",
            style: "normal",
        });
    }

    public async render(data: ScorepostViewDto): Promise<Buffer> {
        if (!data.score.legacyTotalScore) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "A lazer score was passed to the stable scorepost renderer.",
            );
        }

        const [background, staticOverlay, grade, modComposites, perfect, cursor, urPanel] = await Promise.all([
            this.backgroundService.load(data.score),
            this.getStaticOverlay(),
            this.getGrade(data),
            this.getModComposites(data.score.mods),
            data.score.perfect ? this.getPerfectAsset() : Promise.resolve(null),
            data.ur ? this.getCursorAsset() : Promise.resolve(null),
            data.ur ? this.createUrPanel(data.ur) : Promise.resolve(null),
        ]);

        const foreground = this.createForeground(data);
        const composites: Array<OverlayOptions> = [
            {
                input: staticOverlay,
                left: 0,
                top: 0,
            },
            {
                input: grade,
                left: stableScorepostLayout.gradeX,
                top: stableScorepostLayout.gradeY,
            },
            ...modComposites,
        ];

        if (perfect) {
            composites.push({
                input: perfect,
                left: stableScorepostLayout.perfectX,
                top: stableScorepostLayout.perfectY,
            });
        }

        if (cursor) {
            composites.push({
                input: cursor,
                left: stableScorepostLayout.cursorX,
                top: stableScorepostLayout.cursorY,
            });
        }

        if (urPanel) {
            composites.push({
                input: urPanel,
                left: stableScorepostLayout.hitMeterX,
                top: stableScorepostLayout.hitMeterY,
            });
        }

        composites.push({
            input: foreground,
            left: 0,
            top: 0,
        });

        return await sharp(background)
            .composite(composites)
            .jpeg({
                quality: 90,
            })
            .toBuffer();
    }

    //#region Static layers

    private getStaticOverlay(): Promise<Buffer> {
        if (!this.staticOverlay) {
            this.staticOverlay = this.createStaticOverlay();

            this.staticOverlay.catch(() => {
                this.staticOverlay = undefined;
            });
        }

        return this.staticOverlay;
    }

    private async createStaticOverlay(): Promise<Buffer> {
        const [darkLayer, top, overlay] = await Promise.all([
            this.getAsset(path.join(this.assets, "darklayer.png")),
            this.getAsset(path.join(this.assets, "top.png")),
            this.getAsset(path.join(this.assets, "overlay.png")),
        ]);

        return await sharp({
            create: {
                width: scorepostDimensions.width,
                height: scorepostDimensions.height,
                channels: 4,
                background: {
                    r: 0,
                    g: 0,
                    b: 0,
                    alpha: 0,
                },
            },
        })
            .composite([
                {
                    input: darkLayer.buffer,
                    left: stableScorepostLayout.darkLayerX,
                    top: stableScorepostLayout.darkLayerY,
                },
                {
                    input: top.buffer,
                    left: stableScorepostLayout.topX,
                    top: stableScorepostLayout.topY,
                },
                {
                    input: overlay.buffer,
                    left: stableScorepostLayout.overlayX,
                    top: stableScorepostLayout.overlayY,
                },
            ])
            .png({
                compressionLevel: 6,
                adaptiveFiltering: true,
            })
            .toBuffer();
    }

    //#endregion

    //#region Grade / perfect

    private async getGrade(data: ScorepostViewDto): Promise<Buffer> {
        const grade = String(data.score.grade).toLowerCase();

        return await this.getResizedAsset(
            path.join(this.assets, `ranking-${grade}.png`),
            stableScorepostLayout.gradeWidth,
            stableScorepostLayout.gradeHeight,
        );
    }

    private async getPerfectAsset(): Promise<Buffer> {
        return await this.getResizedAsset(
            path.join(this.assets, "ranking-perfect.png"),
            stableScorepostLayout.perfectWidth,
            stableScorepostLayout.perfectHeight,
        );
    }

    //#endregion

    //#region Cursor

    private async getCursorAsset(): Promise<Buffer> {
        const asset = await this.getAsset(path.join(this.assets, "cursor.png"));

        return asset.buffer;
    }

    //#endregion

    //#region Mods

    private async getModComposites(mods: ReadonlyArray<ParsedMod>): Promise<Array<OverlayOptions>> {
        const supportedMods = mods
            .map((mod) => {
                const filename = stableScorepostModAssets[mod.acronym];

                if (!filename) {
                    return null;
                }

                return {
                    acronym: mod.acronym,
                    filename,
                };
            })
            .filter(
                (
                    mod,
                ): mod is {
                    acronym: string;
                    filename: string;
                } => mod !== null,
            );

        const images = await Promise.all(
            supportedMods.map((mod) =>
                this.getResizedAsset(
                    path.join(this.assets, `${mod.filename}.png`),
                    stableScorepostLayout.modSize,
                    stableScorepostLayout.modSize,
                ),
            ),
        );

        return images.map((input, index) => ({
            input,
            left: stableScorepostLayout.modStartX - index * stableScorepostLayout.modOverlap,
            top: stableScorepostLayout.modY,
        }));
    }

    //#endregion

    //#region Foreground

    private createForeground(data: ScorepostViewDto): Buffer {
        const canvas = createCanvas(scorepostDimensions.width, scorepostDimensions.height);
        const ctx = canvas.getContext("2d");

        this.drawHeader(ctx, data);
        this.drawRankingPanel(ctx, data);

        return canvas.toBuffer("image/png");
    }

    private drawHeader(ctx: CanvasRenderingContext2D, data: ScorepostViewDto): void {
        const title =
            `${data.score.beatmapset.artist} - ` +
            `${data.score.beatmapset.title} ` +
            `[${data.score.beatmap.version}]`;

        this.drawMetadataText(ctx, title, 41, stableScorepostLayout.titleX, stableScorepostLayout.titleY);

        this.drawMetadataText(
            ctx,
            `Beatmap by ${data.score.beatmapset.creator}`,
            30,
            stableScorepostLayout.mapperX,
            stableScorepostLayout.mapperY,
        );

        this.drawMetadataText(
            ctx,
            `Played by ${data.user.username} on ${ScorepostFormatter.dateStable(data.score.endedAt, data.timezoneOffset)}`,
            30,
            stableScorepostLayout.playedByX,
            stableScorepostLayout.playedByY,
        );
    }

    private drawMetadataText(
        ctx: CanvasRenderingContext2D,
        value: string,
        fontSize: number,
        x: number,
        y: number,
    ): void {
        ctx.save();

        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "alphabetic";
        ctx.font = `${fontSize}px "Aller"`;

        const metrics = ctx.measureText(value);
        const baselineY = y + metrics.actualBoundingBoxAscent;

        const runs = value.match(/\d+|[^\d]+/g) ?? [];
        let currentX = x;

        for (const run of runs) {
            const numeric = /^\d+$/.test(run);

            if (numeric) {
                const numericSize = fontSize * 0.76;

                ctx.font = `${numericSize}px "Aller"`;
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 0.3;
                ctx.lineJoin = "round";

                ctx.strokeText(run, currentX, baselineY);
                ctx.fillText(run, currentX, baselineY);
            } else {
                ctx.font = `${fontSize}px "Aller"`;

                ctx.fillText(run, currentX, baselineY);
            }

            currentX += ctx.measureText(run).width;
        }

        ctx.restore();
    }

    private drawRankingPanel(ctx: CanvasRenderingContext2D, data: ScorepostViewDto): void {
        const score = data.score;

        if (!score.legacyTotalScore) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "Stable scorepost is missing legacy total score.");
        }

        const statistics = score.statistics;
        const totalScore = score.legacyTotalScore.toString().padStart(8, "0").split("").join("\u200A");

        this.drawRankingPanelElement(ctx, totalScore, 91, stableScorepostLayout.scoreX, stableScorepostLayout.scoreY);

        this.drawRankingPanelElement(
            ctx,
            `${statistics.great}x`,
            81,
            stableScorepostLayout.count300X,
            stableScorepostLayout.count300Y,
        );

        this.drawRankingPanelElement(
            ctx,
            `${statistics.ok}x`,
            81,
            stableScorepostLayout.count100X,
            stableScorepostLayout.count100Y,
        );

        this.drawRankingPanelElement(
            ctx,
            `${statistics.meh}x`,
            81,
            stableScorepostLayout.count50X,
            stableScorepostLayout.count50Y,
        );

        this.drawRankingPanelElement(ctx, "0x", 81, stableScorepostLayout.countGekiX, stableScorepostLayout.countGekiY);

        this.drawRankingPanelElement(ctx, "0x", 81, stableScorepostLayout.countKatuX, stableScorepostLayout.countKatuY);

        this.drawRankingPanelElement(
            ctx,
            `${statistics.miss}x`,
            81,
            stableScorepostLayout.countMissX,
            stableScorepostLayout.countMissY,
        );

        this.drawRankingPanelElement(
            ctx,
            `${score.maxCombo}x`,
            81,
            stableScorepostLayout.comboX,
            stableScorepostLayout.comboY,
        );

        this.drawRankingPanelElement(
            ctx,
            `${(score.accuracy * 100).toFixed(2)}%`,
            81,
            stableScorepostLayout.accuracyX,
            stableScorepostLayout.accuracyY,
        );
    }

    private drawRankingPanelElement(
        ctx: CanvasRenderingContext2D,
        value: string,
        fontSize: number,
        x: number,
        y: number,
    ): void {
        ctx.save();

        ctx.font = `${fontSize}px "Roboto Slab"`;
        ctx.textBaseline = "alphabetic";
        ctx.lineJoin = "round";

        const metrics = ctx.measureText(value);

        const drawX = x - metrics.actualBoundingBoxLeft;
        const drawY = y + metrics.actualBoundingBoxAscent;

        // Shadow pass
        ctx.fillStyle = "#000000";
        ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = -8;
        ctx.shadowOffsetY = 5;

        ctx.fillText(value, drawX, drawY);

        // Disable shadow for the actual glyph
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Thin outline
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1;

        ctx.strokeText(value, drawX, drawY);

        // White face
        ctx.fillStyle = "#ffffff";

        ctx.fillText(value, drawX, drawY);

        ctx.restore();
    }

    //#endregion

    //#region Asset cache

    private getAsset(filePath: string): Promise<ICachedScorepostAsset> {
        let cached = this.assetCache.get(filePath);

        if (!cached) {
            cached = this.readAsset(filePath);
            this.assetCache.set(filePath, cached);
            cached.catch(() => this.assetCache.delete(filePath));
        }

        return cached;
    }

    private async readAsset(filePath: string): Promise<ICachedScorepostAsset> {
        const buffer = await readFile(filePath);
        const metadata = await sharp(buffer).metadata();

        if (!metadata.width || !metadata.height) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                `Could not determine dimensions for scorepost asset: ${filePath}`,
            );
        }

        return {
            buffer,
            width: metadata.width,
            height: metadata.height,
        };
    }

    private getResizedAsset(filePath: string, width: number, height: number): Promise<Buffer> {
        const cacheKey = `${filePath}:${width}x${height}`;
        let cached = this.resizedAssetCache.get(cacheKey);

        if (!cached) {
            cached = this.resizeAsset(filePath, width, height);
            this.resizedAssetCache.set(cacheKey, cached);
            cached.catch(() => this.resizedAssetCache.delete(cacheKey));
        }

        return cached;
    }

    private async resizeAsset(filePath: string, width: number, height: number): Promise<Buffer> {
        const asset = await this.getAsset(filePath);

        return await sharp(asset.buffer)
            .resize(width, height, {
                fit: "fill",
            })
            .png()
            .toBuffer();
    }

    //#endregion

    //#region Hit statistics

    private async createUrPanel(ur: number): Promise<Buffer> {
        const hitMeter = await this.getAsset(path.join(this.assets, "hitmeter.png"));

        const fontSize = 14;
        const lineSpacing = 4;

        const lines = ["Accuracy:", "Error: -ms - -ms avg", `Unstable Rate: ${ur.toFixed(2)}`];

        const textOffsetX = stableScorepostLayout.hitStatisticsX - stableScorepostLayout.hitMeterX;
        const textOffsetY = stableScorepostLayout.hitStatisticsY - stableScorepostLayout.hitMeterY;

        const measurementCanvas = createCanvas(1, 1);
        const measurementContext = measurementCanvas.getContext("2d");

        measurementContext.font = `${fontSize}px "ScorepostAller"`;

        const textWidth = Math.ceil(
            Math.max(...lines.map((line) => this.measureHitStatisticsText(measurementContext, line, fontSize))),
        );

        const panelWidth = textWidth + textOffsetX + 5;
        const panelHeight = stableScorepostLayout.hitMeterHeight;

        const textCanvas = createCanvas(panelWidth, panelHeight);
        const ctx = textCanvas.getContext("2d");

        let y = textOffsetY;

        for (const line of lines) {
            this.drawHitStatisticsText(ctx, line, fontSize, textOffsetX, y);
            y += fontSize + lineSpacing;
        }

        const resizedHitMeter = await sharp(hitMeter.buffer)
            .resize(panelWidth, panelHeight, {
                fit: "fill",
            })
            .png()
            .toBuffer();

        return await sharp(resizedHitMeter)
            .composite([
                {
                    input: textCanvas.toBuffer("image/png"),
                    left: 0,
                    top: 0,
                },
            ])
            .png()
            .toBuffer();
    }

    private drawHitStatisticsText(
        ctx: CanvasRenderingContext2D,
        value: string,
        fontSize: number,
        x: number,
        y: number,
    ): void {
        ctx.save();

        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "alphabetic";
        ctx.lineJoin = "round";

        ctx.font = `${fontSize}px "ScorepostAller"`;

        const baseMetrics = ctx.measureText(value);
        const baselineY = y + baseMetrics.actualBoundingBoxAscent;

        const runs = value.match(/\d+(?:\.\d+)?|[^\d]+/g) ?? [];

        let currentX = x;

        for (const run of runs) {
            const numeric = /^\d/.test(run);

            if (numeric) {
                const numericSize = fontSize * 0.76;

                ctx.font = `${numericSize}px "ScorepostAller"`;
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 0.4;

                ctx.strokeText(run, currentX, baselineY);
                ctx.fillText(run, currentX, baselineY);
            } else {
                ctx.font = `${fontSize}px "ScorepostAller"`;
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 0.3;

                ctx.strokeText(run, currentX, baselineY);
                ctx.fillText(run, currentX, baselineY);
            }

            currentX += ctx.measureText(run).width;
        }

        ctx.restore();
    }

    private measureHitStatisticsText(ctx: CanvasRenderingContext2D, value: string, fontSize: number): number {
        const runs = value.match(/\d+(?:\.\d+)?|[^\d]+/g) ?? [];

        let width = 0;

        for (const run of runs) {
            const numeric = /^\d/.test(run);
            ctx.font = numeric ? `${fontSize * 0.76}px "ScorepostAller"` : `${fontSize}px "ScorepostAller"`;
            width += ctx.measureText(run).width;
        }

        return width;
    }

    //#endregion
}
