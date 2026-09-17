import { readFile } from "node:fs/promises";
import path from "node:path";
import { CanvasRenderingContext2D, createCanvas, registerFont } from "canvas";
import sharp, { type OverlayOptions } from "sharp";
import { Import } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { stableScorepostLayout, stableScorepostModAssets } from "@domain/osu/configs/Scorepost.config";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ScorepostViewDto } from "@domain/osu/views/Scorepost.view";
import { ParsedMod } from "@generated/adapter/mods";
import { ScorepostBackgroundService } from "./ScorepostBackground.service";
import { ScorepostFormatter } from "@domain/osu/formatters/Scorepost.formatter";
import { ScorepostScaler } from "@domain/osu/utils/ScorepostScaler";

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

    private readonly staticOverlayCache = new Map<number, Promise<Buffer>>();

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

        const scaler = new ScorepostScaler(data.resolution);

        const [background, staticOverlay, grade, modComposites, perfect, cursor, urPanel] = await Promise.all([
            this.createBackground(data, scaler),
            this.getStaticOverlay(scaler),
            this.getGrade(data, scaler),
            this.getModComposites(data.score.mods, scaler),
            data.score.perfect ? this.getPerfectAsset(scaler) : Promise.resolve(null),
            data.ur ? this.getCursorAsset(scaler) : Promise.resolve(null),
            data.ur ? this.createUrPanel(data.ur, scaler) : Promise.resolve(null),
        ]);

        const foreground = this.createForeground(data, scaler);
        const composites: Array<OverlayOptions> = [
            {
                input: staticOverlay,
                left: 0,
                top: 0,
            },
            {
                input: grade,
                left: scaler.pixel(stableScorepostLayout.gradeX),
                top: scaler.pixel(stableScorepostLayout.gradeY),
            },
            ...modComposites,
        ];

        if (perfect) {
            composites.push({
                input: perfect,
                left: scaler.pixel(stableScorepostLayout.perfectX),
                top: scaler.pixel(stableScorepostLayout.perfectY),
            });
        }

        if (cursor) {
            composites.push({
                input: cursor,
                left: scaler.pixel(stableScorepostLayout.cursorX),
                top: scaler.pixel(stableScorepostLayout.cursorY),
            });
        }

        if (urPanel) {
            composites.push({
                input: urPanel,
                left: scaler.pixel(stableScorepostLayout.hitMeterX),
                top: scaler.pixel(stableScorepostLayout.hitMeterY),
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

    //#region Background

    private async createBackground(data: ScorepostViewDto, scaler: ScorepostScaler): Promise<Buffer> {
        return await this.backgroundService.load(data.score, scaler);
    }

    //#endregion

    //#region Static layers

    private getStaticOverlay(scaler: ScorepostScaler): Promise<Buffer> {
        const key = scaler.resolution;
        let cached = this.staticOverlayCache.get(key);

        if (!cached) {
            cached = this.createStaticOverlay(scaler);
            this.staticOverlayCache.set(key, cached);

            cached.catch(() => {
                this.staticOverlayCache.delete(key);
            });
        }

        return cached;
    }

    private async createStaticOverlay(scaler: ScorepostScaler): Promise<Buffer> {
        const [darkLayer, top, overlay] = await Promise.all([
            this.getScaledAsset(path.join(this.assets, "darklayer.png"), scaler),
            this.getScaledAsset(path.join(this.assets, "top.png"), scaler),
            this.getScaledAsset(path.join(this.assets, "overlay.png"), scaler),
        ]);

        return await sharp({
            create: {
                width: scaler.width,
                height: scaler.height,
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
                    left: scaler.pixel(stableScorepostLayout.darkLayerX),
                    top: scaler.pixel(stableScorepostLayout.darkLayerY),
                },
                {
                    input: top.buffer,
                    left: scaler.pixel(stableScorepostLayout.topX),
                    top: scaler.pixel(stableScorepostLayout.topY),
                },
                {
                    input: overlay.buffer,
                    left: scaler.pixel(stableScorepostLayout.overlayX),
                    top: scaler.pixel(stableScorepostLayout.overlayY),
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

    private async getGrade(data: ScorepostViewDto, scaler: ScorepostScaler): Promise<Buffer> {
        const grade = String(data.score.grade).toLowerCase();

        return await this.getResizedAsset(
            path.join(this.assets, `ranking-${grade}.png`),
            scaler.pixel(stableScorepostLayout.gradeWidth),
            scaler.pixel(stableScorepostLayout.gradeHeight),
        );
    }

    private async getPerfectAsset(scaler: ScorepostScaler): Promise<Buffer> {
        return await this.getResizedAsset(
            path.join(this.assets, "ranking-perfect.png"),
            scaler.pixel(stableScorepostLayout.perfectWidth),
            scaler.pixel(stableScorepostLayout.perfectHeight),
        );
    }

    //#endregion

    //#region Cursor

    private async getCursorAsset(scaler: ScorepostScaler): Promise<Buffer> {
        const asset = await this.getScaledAsset(path.join(this.assets, "cursor.png"), scaler);

        return asset.buffer;
    }

    //#endregion

    //#region Mods

    private async getModComposites(
        mods: ReadonlyArray<ParsedMod>,
        scaler: ScorepostScaler,
    ): Promise<Array<OverlayOptions>> {
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
                    scaler.pixel(stableScorepostLayout.modSize),
                    scaler.pixel(stableScorepostLayout.modSize),
                ),
            ),
        );

        return images.map((input, index) => ({
            input,
            left: scaler.pixel(stableScorepostLayout.modStartX - index * stableScorepostLayout.modOverlap),
            top: scaler.pixel(stableScorepostLayout.modY),
        }));
    }

    //#endregion

    //#region Foreground

    private createForeground(data: ScorepostViewDto, scaler: ScorepostScaler): Buffer {
        const canvas = createCanvas(scaler.width, scaler.height);
        const ctx = canvas.getContext("2d");

        ctx.scale(scaler.factor, scaler.factor);

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

    private async getScaledAsset(filePath: string, scaler: ScorepostScaler): Promise<ICachedScorepostAsset> {
        const asset = await this.getAsset(filePath);

        if (scaler.isIdentity) {
            return asset;
        }

        const width = Math.max(1, scaler.pixel(asset.width));
        const height = Math.max(1, scaler.pixel(asset.height));
        const buffer = await this.getResizedAsset(filePath, width, height);

        return {
            buffer,
            width,
            height,
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

    private async createUrPanel(ur: number, scaler: ScorepostScaler): Promise<Buffer> {
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
        const outputWidth = scaler.pixel(panelWidth);
        const outputHeight = scaler.pixel(panelHeight);

        const textCanvas = createCanvas(outputWidth, outputHeight);
        const ctx = textCanvas.getContext("2d");

        ctx.scale(scaler.factor, scaler.factor);

        let y = textOffsetY;

        for (const line of lines) {
            this.drawHitStatisticsText(ctx, line, fontSize, textOffsetX, y);
            y += fontSize + lineSpacing;
        }

        const resizedHitMeter = await sharp(hitMeter.buffer)
            .resize(outputWidth, outputHeight, {
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
