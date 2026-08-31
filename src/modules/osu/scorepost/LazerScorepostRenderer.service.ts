import path from "path";
import { readFile } from "fs/promises";
import { CanvasRenderingContext2D, createCanvas, registerFont } from "canvas";
import sharp, { type OverlayOptions } from "sharp";
import { Import } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { HttpClient } from "@/http";
import { EApplicationError, Exception } from "@domain/core/Exception";
import {
    lazerScorepostConfig,
    lazerScorepostLayout,
    lazerScorepostModStyles,
    scorepostDimensions,
} from "@domain/osu/configs/Scorepost.config";
import { ScorepostViewDto } from "@domain/osu/views/Scorepost.view";
import { ParsedMod } from "@generated/adapter/mods";
import { ScorepostBackgroundService } from "./ScorepostBackground.service";
import { isValidNumber } from "@domain/utils/utils";
import { GameMode, Grade } from "@generated/adapter/types";
import { ScorepostFormatter } from "@domain/osu/formatters/Scorepost.formatter";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";

interface ICachedAsset {
    buffer: Buffer;
    width: number;
    height: number;
}

interface IModStyle {
    asset: string;
    textColour: string;
}

interface IModLayoutItem {
    mod: ParsedMod;
    style: IModStyle;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
}

interface IModLayout {
    items: ReadonlyArray<IModLayoutItem>;
    wrapped: boolean;
}

interface IColourStop {
    value: number;
    colour: string;
}

interface IRgb {
    r: number;
    g: number;
    b: number;
}

interface ITextRun {
    value: string;
    family: string;
}

interface ITextOptions {
    x: number;
    y: number;
    family: string;
    size: number;
    minSize: number;
    maxWidth: number;
    colour: string;
    tracking?: number;
}

interface ILeftTextOptions {
    x: number;
    y: number;
    family: string;
    size: number;
    colour: string;
    tracking?: number;
}

export class LazerScorepostRendererService extends AbstractService {
    @Import() declare private readonly backgroundService: ScorepostBackgroundService;

    declare private resources: string;
    declare private assets: string;
    declare private http: HttpClient;

    private readonly assetCache = new Map<string, Promise<ICachedAsset>>();
    private readonly resizedAssetCache = new Map<string, Promise<Buffer>>();

    public async init(): Promise<void> {
        this.resources = path.join(process.cwd(), this.config.app.resources);
        this.assets = path.join(this.resources, "scorepost", "lazer");

        const fontDirectory = path.join(this.resources, "fonts");
        const torusLightPath = path.join(fontDirectory, "TorusPro-Light.ttf");
        const torusRegularPath = path.join(fontDirectory, "TorusPro-Regular.ttf");
        const torusSemiBoldPath = path.join(fontDirectory, "TorusPro-SemiBold.ttf");
        const rubikBoldPath = path.join(fontDirectory, "Rubik-Bold.ttf");
        const fallbackFontPath = path.join(fontDirectory, "RobotoSlab-Regular.ttf");

        registerFont(torusLightPath, { family: lazerScorepostConfig.fonts.torusLight });
        registerFont(torusRegularPath, { family: lazerScorepostConfig.fonts.torusRegular });
        registerFont(torusSemiBoldPath, { family: lazerScorepostConfig.fonts.torusSemiBold });
        registerFont(rubikBoldPath, { family: lazerScorepostConfig.fonts.rubikBold });
        registerFont(fallbackFontPath, { family: lazerScorepostConfig.fonts.fallback });

        this.http = new HttpClient(this.logger, { name: "LazerScorepost", timeout: 10_000 });
    }

    public async render(data: ScorepostViewDto): Promise<Buffer> {
        if (data.score.legacyTotalScore) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "A stable score was passed to the lazer scorepost renderer.",
            );
        }

        if (!data.score.maximumStatistics) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "Lazer scorepost is missing maximum statistics.");
        }

        const modLayout = this.createModLayout(data.score.mods);
        const scoreMode = data.score.mode ?? GameMode.Standard;

        const [
            background,
            skeletonComposites,
            base,
            statsBase,
            cover,
            avatar,
            wheel,
            starRatingBadge,
            mode,
            perfect,
            modComposites,
        ] = await Promise.all([
            this.createBackground(data),
            this.createSkeletonComposites(data.score.globalTop),
            this.getAsset(path.join(this.assets, "base.png")),
            this.getAsset(path.join(this.assets, "stats-base.png")),
            this.createStatisticsCover(data.user.cover?.url),
            this.createAvatar(data.user.avatarUrl),
            this.createWheel(data),
            this.createStarRatingBadge(data.score.fullDifficulty.starRating),
            this.getResizedAsset(
                path.join(this.resources, "mode", scoreMode.toLowerCase() + ".png"),
                lazerScorepostLayout.modeSize,
                lazerScorepostLayout.modeSize,
            ),
            data.score.perfect ? this.getAsset(path.join(this.assets, "perfect.png")) : Promise.resolve(null),
            this.createModComposites(modLayout),
        ]);

        const foreground = this.createForeground(data, modLayout);

        const composites: Array<OverlayOptions> = [
            ...skeletonComposites,
            {
                input: base.buffer,
                left: Math.round(lazerScorepostLayout.baseCenterX - base.width / 2),
                top: lazerScorepostConfig.baseCropTop,
            },
            {
                input: cover,
                left: Math.round(lazerScorepostLayout.statisticsCoverX - lazerScorepostLayout.statisticsCoverWidth / 2),
                top: Math.round(lazerScorepostLayout.statisticsCoverY - lazerScorepostLayout.statisticsCoverHeight / 2),
            },
            {
                input: statsBase.buffer,
                left: Math.round(lazerScorepostLayout.statsBaseX - statsBase.width / 2),
                top: Math.round(lazerScorepostLayout.statsBaseY - statsBase.height / 2),
            },
            {
                input: wheel,
                left: Math.round(lazerScorepostLayout.wheelX - lazerScorepostLayout.wheelWidth / 2),
                top: Math.round(lazerScorepostLayout.wheelY - lazerScorepostLayout.wheelHeight / 2),
            },
            ...modComposites,
            {
                input: foreground,
                left: 0,
                top: 0,
            },
            {
                input: starRatingBadge,
                left: Math.round(lazerScorepostLayout.starRatingX - lazerScorepostLayout.starRatingWidth / 2),
                top: Math.round(lazerScorepostLayout.starRatingY - lazerScorepostLayout.starRatingHeight / 2),
            },
            {
                input: mode,
                left: Math.round(lazerScorepostLayout.modeX - lazerScorepostLayout.modeSize / 2),
                top: Math.round(lazerScorepostLayout.modeY - lazerScorepostLayout.modeSize / 2),
            },
        ];

        if (perfect) {
            composites.push({
                input: perfect.buffer,
                left: Math.round(lazerScorepostLayout.perfectX - perfect.width / 2),
                top: Math.round(
                    lazerScorepostLayout.perfectY + lazerScorepostConfig.statisticsValueOffsetY - perfect.height / 2,
                ),
            });
        }

        if (avatar) {
            composites.push({
                input: avatar,
                left: Math.round(lazerScorepostLayout.avatarX - lazerScorepostLayout.avatarWidth / 2),
                top: Math.round(lazerScorepostLayout.avatarY - lazerScorepostLayout.avatarHeight / 2),
            });
        }

        return await sharp(background)
            .composite(composites)
            .png({
                compressionLevel: 6,
                adaptiveFiltering: true,
            })
            .toBuffer();
    }

    //#region Skeleton cards

    private async createSkeletonComposites(globalTop?: number | null): Promise<Array<OverlayOptions>> {
        if (!isValidNumber(globalTop)) globalTop = 50;

        const skeleton = await this.getAsset(path.join(this.assets, "skeleton-card.png"));

        const stepX = lazerScorepostConfig.skeleton.width + lazerScorepostConfig.skeleton.gap;
        const nearestOffsetX =
            lazerScorepostLayout.statisticsCoverWidth / 2 +
            lazerScorepostConfig.skeleton.width / 2 +
            lazerScorepostConfig.skeleton.gap;

        const leftCount = Math.min(globalTop, lazerScorepostConfig.skeleton.maximumPerSide);
        const rightCount = lazerScorepostConfig.skeleton.maximumPerSide;

        const composites: Array<OverlayOptions> = [];

        for (let index = leftCount - 1; index >= 0; index--) {
            const centerX = lazerScorepostLayout.baseCenterX - nearestOffsetX - index * stepX;

            composites.push({
                input: skeleton.buffer,
                left: Math.round(centerX - skeleton.width / 2),
                top: lazerScorepostConfig.skeleton.top,
            });
        }

        for (let index = rightCount - 1; index >= 0; index--) {
            const centerX = lazerScorepostLayout.baseCenterX + nearestOffsetX + index * stepX;

            composites.push({
                input: skeleton.buffer,
                left: Math.round(centerX - skeleton.width / 2),
                top: lazerScorepostConfig.skeleton.top,
            });
        }

        return composites;
    }

    //#endregion

    //#region Background

    private async createBackground(data: ScorepostViewDto): Promise<Buffer> {
        const source = await this.backgroundService.load(data.score);

        const darkLayer = Buffer.from(`
                <svg
                    width="${scorepostDimensions.width}"
                    height="${scorepostDimensions.height}"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <rect
                        width="100%"
                        height="100%"
                        fill="#000000"
                        fill-opacity="0.50"
                    />
                </svg>
            `);

        return await sharp(source)
            .blur(3)
            .composite([
                {
                    input: darkLayer,
                    left: 0,
                    top: 0,
                },
            ])
            .png()
            .toBuffer();
    }

    //#endregion

    //#region Profile imagery

    private async createStatisticsCover(url?: string): Promise<Buffer> {
        const {
            statisticsCoverWidth: width,
            statisticsCoverHeight: height,
            statisticsCoverRadius: radius,
        } = lazerScorepostLayout;

        const remote = url ? await this.fetchRemoteImage(url) : null;

        const source = remote
            ? sharp(remote, {
                  limitInputPixels: 33_554_432,
              }).resize(width, height, {
                  fit: "cover",
                  position: "centre",
              })
            : sharp({
                  create: {
                      width,
                      height,
                      channels: 4,
                      background: {
                          r: 52,
                          g: 52,
                          b: 52,
                          alpha: 1,
                      },
                  },
              });

        const gradient = Buffer.from(`
                <svg
                    width="${width}"
                    height="${height}"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        <linearGradient
                            id="cover-gradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="0%"
                                stop-color="#343434"
                                stop-opacity="0.52"
                            />

                            <stop
                                offset="40%"
                                stop-color="#343434"
                                stop-opacity="0.72"
                            />

                            <stop
                                offset="72%"
                                stop-color="#343434"
                                stop-opacity="0.90"
                            />

                            <stop
                                offset="100%"
                                stop-color="#343434"
                                stop-opacity="0.98"
                            />
                        </linearGradient>
                    </defs>

                    <rect
                        width="100%"
                        height="100%"
                        fill="url(#cover-gradient)"
                    />
                </svg>
            `);

        const mask = this.createRoundedMask(width, height, radius);

        return await source
            .ensureAlpha()
            .composite([
                {
                    input: gradient,
                },
                {
                    input: mask,
                    blend: "dest-in",
                },
            ])
            .png()
            .toBuffer();
    }

    private async createAvatar(url?: string): Promise<Buffer | null> {
        if (!url) {
            return null;
        }

        const source = await this.fetchRemoteImage(url);
        if (!source) {
            return null;
        }

        const { avatarWidth: width, avatarHeight: height, avatarRadius: radius } = lazerScorepostLayout;
        const mask = this.createRoundedMask(width, height, radius);

        try {
            return await sharp(source, {
                limitInputPixels: 16_777_216,
            })
                .resize(width, height, {
                    fit: "cover",
                    position: "centre",
                })
                .ensureAlpha()
                .composite([
                    {
                        input: mask,
                        blend: "dest-in",
                    },
                ])
                .png()
                .toBuffer();
        } catch {
            return null;
        }
    }

    private createRoundedMask(width: number, height: number, radius: number): Buffer {
        return Buffer.from(`
            <svg
                width="${width}"
                height="${height}"
                xmlns="http://www.w3.org/2000/svg"
            >
                <rect
                    x="0"
                    y="0"
                    width="${width}"
                    height="${height}"
                    rx="${radius}"
                    ry="${radius}"
                    fill="#ffffff"
                />
            </svg>
        `);
    }

    private async fetchRemoteImage(url: string): Promise<Buffer | null> {
        try {
            const source = await this.http.get<Buffer>(url, {
                responseType: "arraybuffer",
            });

            if (!source?.length) {
                return null;
            }

            return Buffer.from(source);
        } catch {
            return null;
        }
    }

    //#endregion

    //#region Wheel

    private async createWheel(data: ScorepostViewDto): Promise<Buffer> {
        const gradeName = data.score.grade.toLowerCase();

        const [base, badges, grade] = await Promise.all([
            this.getAsset(path.join(this.assets, "accuracy-wheel-base.png")),
            this.getAsset(path.join(this.assets, `badges-${gradeName}.png`)),
            this.getAsset(path.join(this.assets, `grade-${gradeName}.png`)),
        ]);

        const accuracyArc = this.createAccuracyArc(data.score.accuracy, data.score.grade);

        const composed = await sharp(base.buffer)
            .composite([
                {
                    input: accuracyArc,
                },
                {
                    input: badges.buffer,
                },
                {
                    input: grade.buffer,
                },
            ])
            .png()
            .toBuffer();

        return await sharp(composed)
            .trim()
            .resize(lazerScorepostLayout.wheelWidth, lazerScorepostLayout.wheelHeight, {
                fit: "contain",
                position: "centre",
                background: {
                    r: 0,
                    g: 0,
                    b: 0,
                    alpha: 0,
                },
            })
            .png()
            .toBuffer();
    }

    private createAccuracyArc(accuracy: number, grade: Grade): Buffer {
        const canvasSize = 640;
        const logicalCanvasSize = 300;
        const logicalAccuracySize = 230;

        const outputScale = canvasSize / logicalCanvasSize;
        const innerRadius = 0.2;
        const thickness = (logicalAccuracySize * innerRadius) / 2;
        const strokeRadius = logicalAccuracySize / 2 - thickness / 2;

        const canvas = createCanvas(canvasSize, canvasSize);
        const ctx = canvas.getContext("2d");

        const center = canvasSize / 2;

        const target = this.getVisualAccuracy(accuracy, grade);
        const outerRadius = (logicalAccuracySize / 2) * outputScale;

        const gradient = ctx.createLinearGradient(0, center - outerRadius, 0, center + outerRadius);

        gradient.addColorStop(0, "#7CF6FF");
        gradient.addColorStop(1, "#BAFFA9");

        const start = -Math.PI / 2;
        const end = start + target * Math.PI * 2;

        ctx.beginPath();

        ctx.arc(
            center,
            center,

            strokeRadius * outputScale,

            start,
            end,

            false,
        );

        ctx.strokeStyle = gradient;
        ctx.lineWidth = thickness * outputScale;
        ctx.lineCap = "butt";
        ctx.stroke();

        return canvas.toBuffer("image/png");
    }

    private getVisualAccuracy(accuracy: number, grade: Grade): number {
        const virtualSs = 0.01;
        const gradeSpacingPercentage = 2 / 360;
        const halfGap = gradeSpacingPercentage / 2;
        const visualAlignmentOffset = 0.001;

        const sAccuracy = 0.95;
        if (grade === Grade.SS || grade === Grade.SSH) {
            return 1;
        }

        if (grade === Grade.A && accuracy >= sAccuracy) {
            return sAccuracy - halfGap - visualAlignmentOffset;
        }

        let target = Math.max(0, Math.min(accuracy, 1 - virtualSs - halfGap));
        const notchPercentages = [0.95, 0.9, 0.8, 0.7];

        for (const notch of notchPercentages) {
            if (Math.abs(notch - target) <= halfGap) {
                const direction = target - notch >= 0 ? 1 : -1;
                target = notch + direction * halfGap;
                break;
            }
        }

        if (target < 1 && target >= visualAlignmentOffset) {
            target -= visualAlignmentOffset;
        }

        return target;
    }

    //#endregion

    //#region Star rating

    private async createStarRatingBadge(starRating: number): Promise<Buffer> {
        const width = lazerScorepostLayout.starRatingWidth;
        const height = lazerScorepostLayout.starRatingHeight;
        const starSize = lazerScorepostLayout.starIconSize;
        const value = MapFormatter.stars(starRating, false, false);
        const style = this.getStarRatingStyle(starRating);
        const canvas = createCanvas(width, height);

        const ctx = canvas.getContext("2d");

        this.roundedRect(ctx, 0, 0, width, height, height / 2);

        ctx.fillStyle = style.background;
        ctx.fill();

        const fontSize = 18;

        ctx.font = this.getFont(fontSize, lazerScorepostConfig.fonts.torusSemiBold);

        const textMetrics = ctx.measureText(value);
        const textWidth = textMetrics.width;

        const gap = 4;

        const contentWidth = starSize + gap + textWidth;
        const contentStartX = (width - contentWidth) / 2;
        const starLeft = Math.round(contentStartX);
        const starTop = Math.round((height - starSize) / 2);
        const textX = contentStartX + starSize + gap;
        const baselineY = height / 2 + (textMetrics.actualBoundingBoxAscent - textMetrics.actualBoundingBoxDescent) / 2;

        ctx.fillStyle = style.text;
        ctx.fillText(value, textX, baselineY);

        const star = await this.createColouredStar(starSize, style.text);
        return await sharp(canvas.toBuffer("image/png"))
            .composite([
                {
                    input: star,
                    left: starLeft,
                    top: starTop,
                },
            ])
            .png()
            .toBuffer();
    }

    private async createColouredStar(size: number, colour: string): Promise<Buffer> {
        const mask = await this.getResizedAsset(path.join(this.assets, "star.png"), size, size);

        return await sharp({
            create: {
                width: size,
                height: size,
                channels: 4,
                background: colour,
            },
        })
            .composite([
                {
                    input: mask,
                    blend: "dest-in",
                },
            ])
            .png()
            .toBuffer();
    }

    private getStarRatingStyle(starRating: number): {
        background: string;
        text: string;
    } {
        if (starRating < 6.5) {
            return {
                background: this.sampleColourSpectrum(lazerScorepostConfig.starDifficultySpectrum, starRating),
                text: "rgba(0,0,0,0.75)",
            };
        }

        if (starRating < 9) {
            return {
                background: "#000000",
                text: "#ffd966",
            };
        }

        return {
            background: "#000000",
            text: this.sampleColourSpectrum(lazerScorepostConfig.starDifficultyTextSpectrum, starRating),
        };
    }

    private sampleColourSpectrum(spectrum: ReadonlyArray<IColourStop>, value: number): string {
        const rounded = Math.round(value * 100) / 100;

        if (rounded <= spectrum[0]!.value) {
            return spectrum[0]!.colour;
        }

        for (let index = 1; index < spectrum.length; index++) {
            const previous = spectrum[index - 1]!;
            const current = spectrum[index]!;

            if (rounded > current.value) {
                continue;
            }

            if (current.value === previous.value) {
                return current.colour;
            }

            const progress = (rounded - previous.value) / (current.value - previous.value);
            return this.interpolateHex(previous.colour, current.colour, progress);
        }

        return spectrum[spectrum.length - 1]!.colour;
    }

    //#endregion

    //#region Mods

    private createModLayout(mods: ReadonlyArray<ParsedMod>): IModLayout {
        if (mods.length === 0) {
            return {
                items: [],

                wrapped: false,
            };
        }

        const width = 32;

        const inlineHeight = 24;
        const wrappedHeight = 20;

        const gap = 4;
        const inlineStartX = 1038;
        const inlineRightEdge = 1197;
        const totalWidth = mods.length * width + Math.max(0, mods.length - 1) * gap;
        const available = inlineRightEdge - (inlineStartX - width / 2);

        if (totalWidth <= available) {
            return {
                wrapped: false,
                items: mods.map((mod, index) => ({
                    mod,
                    style: lazerScorepostModStyles[mod.type],
                    x: inlineStartX + index * (width + gap),
                    y: lazerScorepostLayout.starRatingY,
                    width,
                    height: inlineHeight,
                    fontSize: 11,
                })),
            };
        }

        const left = 720;
        const right = 1195;

        const rowWidth = right - left;
        const wrappedGap = mods.length > 12 ? 2 : 4;

        const calculatedWidth = (rowWidth - wrappedGap * Math.max(0, mods.length - 1)) / mods.length;
        const wrappedWidth = Math.max(17, Math.min(width, calculatedWidth));
        const fontSize = Math.max(8, Math.min(10, 10 * (wrappedWidth / width)));
        const actualWidth = wrappedWidth * mods.length + wrappedGap * Math.max(0, mods.length - 1);
        const startX = lazerScorepostLayout.difficultyX - actualWidth / 2 + wrappedWidth / 2;

        return {
            wrapped: true,
            items: mods.map((mod, index) => ({
                mod,
                style: lazerScorepostModStyles[mod.type],
                x: startX + index * (wrappedWidth + wrappedGap),
                y: lazerScorepostLayout.wrappedModsY,
                width: wrappedWidth,
                height: wrappedHeight,
                fontSize,
            })),
        };
    }

    private async createModComposites(layout: IModLayout): Promise<Array<OverlayOptions>> {
        return await Promise.all(
            layout.items.map(async (item): Promise<OverlayOptions> => {
                const width = Math.max(1, Math.round(item.width));

                const input = await this.getResizedAsset(path.join(this.assets, item.style.asset), width, item.height);

                return {
                    input,
                    left: Math.round(item.x - width / 2),
                    top: Math.round(item.y - item.height / 2),
                };
            }),
        );
    }

    //#endregion

    //#region Foreground

    private createForeground(data: ScorepostViewDto, mods: IModLayout): Buffer {
        const canvas = createCanvas(scorepostDimensions.width, scorepostDimensions.height);
        const ctx = canvas.getContext("2d");

        this.drawHeader(ctx, data);
        this.drawScore(ctx, data);
        this.drawMods(ctx, mods);
        this.drawDifficultyMetadata(ctx, data, mods.wrapped);
        this.drawStatistics(ctx, data);
        this.drawPlayedOn(ctx, data.score.endedAt, data.timezoneOffset);

        return canvas.toBuffer("image/png");
    }

    private drawHeader(ctx: CanvasRenderingContext2D, data: ScorepostViewDto): void {
        this.drawCenteredText(ctx, data.user.username, {
            x: lazerScorepostLayout.usernameX,
            y: lazerScorepostLayout.usernameY,
            family: lazerScorepostConfig.fonts.torusSemiBold,
            size: 20,
            minSize: 15,
            maxWidth: 450,
            colour: "#ffffff",
        });

        this.drawCenteredText(ctx, data.score.beatmapset.title, {
            x: lazerScorepostLayout.titleX,
            y: lazerScorepostLayout.titleY,
            family: lazerScorepostConfig.fonts.torusSemiBold,
            size: 22,
            minSize: 15,
            maxWidth: 455,
            tracking: 50,
            colour: "#ffffff",
        });

        this.drawCenteredText(ctx, data.score.beatmapset.artist, {
            x: lazerScorepostLayout.artistX,
            y: lazerScorepostLayout.artistY,
            family: lazerScorepostConfig.fonts.torusSemiBold,
            size: 16,
            minSize: 12,
            maxWidth: 455,
            tracking: 25,
            colour: "#ffffff",
        });
    }

    private drawScore(ctx: CanvasRenderingContext2D, data: ScorepostViewDto): void {
        const value = new Intl.NumberFormat("en-US", {
            maximumFractionDigits: 0,
        }).format(data.score.totalScore);

        this.drawCenteredText(ctx, value, {
            x: lazerScorepostLayout.totalScoreX,
            y: lazerScorepostLayout.totalScoreY,
            family: lazerScorepostConfig.fonts.torusLight,
            size: 73,
            minSize: 58,
            maxWidth: 450,
            colour: "#ffffff",
        });
    }

    private drawMods(ctx: CanvasRenderingContext2D, layout: IModLayout): void {
        for (const item of layout.items) {
            this.drawCenteredText(ctx, item.mod.acronym, {
                x: item.x,
                y: item.y,
                family: lazerScorepostConfig.fonts.rubikBold,
                size: item.fontSize,
                minSize: Math.min(8, item.fontSize),
                maxWidth: Math.max(10, item.width - 4),
                colour: item.style.textColour,
            });
        }
    }

    private drawDifficultyMetadata(ctx: CanvasRenderingContext2D, data: ScorepostViewDto, wrapped: boolean): void {
        const difficultyY = wrapped ? lazerScorepostLayout.wrappedDifficultyY : lazerScorepostLayout.difficultyY;
        const mapperY = wrapped ? lazerScorepostLayout.wrappedMapperY : lazerScorepostLayout.mapperY;
        this.drawCenteredText(ctx, data.score.beatmap.version, {
            x: lazerScorepostLayout.difficultyX,
            y: difficultyY,
            family: lazerScorepostConfig.fonts.torusSemiBold,
            size: 18,
            minSize: 13,
            maxWidth: 450,
            tracking: 40,
            colour: "#ffffff",
        });

        this.drawCenteredRuns(
            ctx,
            [
                {
                    value: "mapped by ",
                    family: lazerScorepostConfig.fonts.torusRegular,
                },
                {
                    value: data.score.beatmapset.creator,
                    family: lazerScorepostConfig.fonts.torusSemiBold,
                },
            ],

            {
                x: lazerScorepostLayout.mapperX,
                y: mapperY,
                size: 14,
                minSize: 11,
                maxWidth: 440,
                tracking: 25,
                colour: "#ffffff",
            },
        );
    }

    private drawStatistics(ctx: CanvasRenderingContext2D, data: ScorepostViewDto): void {
        const score = data.score;
        const statistics = score.statistics;
        const maximum = score.maximumStatistics!;

        const valueStyle = {
            family: lazerScorepostConfig.fonts.torusRegular,
            size: 24,
            minSize: 18,
            colour: "#ffffff",
        } as const;

        this.drawCenteredText(ctx, `${(score.accuracy * 100).toFixed(2)}%`, {
            ...valueStyle,
            x: lazerScorepostLayout.accuracyX,
            y: lazerScorepostLayout.accuracyY + lazerScorepostConfig.statisticsValueOffsetY,
            maxWidth: 105,
            tracking: -50,
        });

        const comboCenterX = score.perfect
            ? (lazerScorepostLayout.comboX + lazerScorepostLayout.maximumComboX) / 2
            : (lazerScorepostLayout.accuracyX + lazerScorepostLayout.ppX) / 2;

        this.drawValueWithMaximum(
            ctx,
            String(score.maxCombo),
            String(data.score.fullDifficulty.maxCombo),
            comboCenterX,
            lazerScorepostLayout.comboY + lazerScorepostConfig.statisticsValueOffsetY,
        );

        this.drawCenteredText(ctx, score.pp !== undefined ? Math.round(score.pp).toString() : "-", {
            ...valueStyle,
            x: lazerScorepostLayout.ppX,
            y: lazerScorepostLayout.ppY + lazerScorepostConfig.statisticsValueOffsetY,
            maxWidth: 90,
            tracking: 65,
        });

        this.drawCenteredText(ctx, String(statistics.great), {
            ...valueStyle,
            x: lazerScorepostLayout.greatX,
            y: lazerScorepostLayout.greatY + lazerScorepostConfig.statisticsValueOffsetY,
            maxWidth: 95,
        });

        this.drawCenteredText(ctx, String(statistics.ok), {
            ...valueStyle,
            x: lazerScorepostLayout.okX,
            y: lazerScorepostLayout.okY + lazerScorepostConfig.statisticsValueOffsetY,
            maxWidth: 95,
        });

        this.drawCenteredText(ctx, String(statistics.meh), {
            ...valueStyle,
            x: lazerScorepostLayout.mehX,
            y: lazerScorepostLayout.mehY + lazerScorepostConfig.statisticsValueOffsetY,
            maxWidth: 95,
        });

        this.drawCenteredText(ctx, String(statistics.miss), {
            ...valueStyle,
            x: lazerScorepostLayout.missX,
            y: lazerScorepostLayout.missY + lazerScorepostConfig.statisticsValueOffsetY,
            maxWidth: 95,
        });

        this.drawValueWithMaximum(
            ctx,
            String(statistics.largeTickHit),
            String(maximum.largeTickHit),
            (lazerScorepostLayout.sliderTickX + lazerScorepostLayout.maximumSliderTickX) / 2,
            lazerScorepostLayout.sliderTickY + lazerScorepostConfig.statisticsValueOffsetY,
        );

        this.drawValueWithMaximum(
            ctx,
            String(statistics.sliderTailHit),
            String(maximum.sliderTailHit),
            (lazerScorepostLayout.sliderEndX + lazerScorepostLayout.maximumSliderEndX) / 2,
            lazerScorepostLayout.sliderEndY + lazerScorepostConfig.statisticsValueOffsetY,
        );
    }

    private drawPlayedOn(ctx: CanvasRenderingContext2D, date: Date, timezoneOffset: number = 0): void {
        this.drawCenteredText(ctx, ScorepostFormatter.dateLazer(date, timezoneOffset), {
            x: lazerScorepostLayout.playedOnX,
            y: lazerScorepostLayout.playedOnY,
            family: lazerScorepostConfig.fonts.torusSemiBold,
            size: 14,
            minSize: 11,
            maxWidth: 430,
            colour: "#ffffff",
        });
    }

    //#endregion

    //#region Compound values

    private drawValueWithMaximum(
        ctx: CanvasRenderingContext2D,
        value: string,
        maximum: string,
        centerX: number,
        y: number,
    ): void {
        const primarySize = 24;
        const maximumSize = 15;

        const gap = 3;

        const maximumValue = `/${maximum}`;
        const primaryWidth = this.measureTrackedText(
            ctx,
            value,
            lazerScorepostConfig.fonts.torusRegular,
            primarySize,
            0,
        );
        const maximumWidth = this.measureTrackedText(
            ctx,
            maximumValue,
            lazerScorepostConfig.fonts.torusRegular,
            maximumSize,
            0,
        );

        const totalWidth = primaryWidth + gap + maximumWidth;
        const startX = centerX - totalWidth / 2;

        this.drawLeftText(ctx, value, {
            x: startX,
            y,
            family: lazerScorepostConfig.fonts.torusRegular,
            size: primarySize,
            colour: "#ffffff",
        });

        this.drawLeftText(ctx, maximumValue, {
            x: startX + primaryWidth + gap,
            y: y + 5,
            family: lazerScorepostConfig.fonts.torusRegular,
            size: maximumSize,
            colour: "#ffffff",
        });
    }

    //#endregion

    //#region Text

    private getFont(size: number, family: string): string {
        return `${size}px ` + `"${family}", ` + `"${lazerScorepostConfig.fonts.fallback}", ` + `sans-serif`;
    }

    private drawCenteredText(ctx: CanvasRenderingContext2D, value: string, options: ITextOptions): void {
        let size = options.size;
        let valueToDraw = value;

        while (size > options.minSize) {
            const width = this.measureTrackedText(ctx, valueToDraw, options.family, size, options.tracking ?? 0);

            if (width <= options.maxWidth) {
                break;
            }

            size -= 1;
        }

        while (
            valueToDraw.length > 1 &&
            this.measureTrackedText(ctx, valueToDraw, options.family, size, options.tracking ?? 0) > options.maxWidth
        ) {
            valueToDraw = `${valueToDraw.slice(0, -2)}…`;
        }

        const width = this.measureTrackedText(ctx, valueToDraw, options.family, size, options.tracking ?? 0);

        this.drawLeftText(ctx, valueToDraw, {
            x: options.x - width / 2,
            y: options.y,
            family: options.family,
            size,
            colour: options.colour,
            tracking: options.tracking,
        });
    }

    private drawLeftText(ctx: CanvasRenderingContext2D, value: string, options: ILeftTextOptions): void {
        const tracking = options.tracking ?? 0;

        const spacing = (options.size * tracking) / 1000;
        const characters = [...value];

        ctx.save();

        ctx.font = this.getFont(options.size, options.family);

        const reference = ctx.measureText(value || "0");
        const baseline = options.y + (reference.actualBoundingBoxAscent - reference.actualBoundingBoxDescent) / 2;

        let x = options.x;

        ctx.fillStyle = options.colour;

        for (let index = 0; index < characters.length; index++) {
            const character = characters[index]!;

            ctx.fillText(character, x, baseline);
            x += ctx.measureText(character).width;

            if (index < characters.length - 1) {
                x += spacing;
            }
        }

        ctx.restore();
    }

    private measureTrackedText(
        ctx: CanvasRenderingContext2D,
        value: string,
        family: string,
        size: number,
        tracking: number,
    ): number {
        const spacing = (size * tracking) / 1000;
        const characters = [...value];

        let width = 0;

        ctx.save();

        ctx.font = this.getFont(size, family);

        for (let index = 0; index < characters.length; index++) {
            width += ctx.measureText(characters[index]!).width;

            if (index < characters.length - 1) {
                width += spacing;
            }
        }

        ctx.restore();

        return width;
    }

    private drawCenteredRuns(
        ctx: CanvasRenderingContext2D,
        runs: ReadonlyArray<ITextRun>,
        options: {
            x: number;
            y: number;
            size: number;
            minSize: number;
            maxWidth: number;
            tracking: number;
            colour: string;
        },
    ): void {
        let size = options.size;

        while (size > options.minSize && this.measureRuns(ctx, runs, size, options.tracking) > options.maxWidth) {
            size -= 1;
        }

        const totalWidth = this.measureRuns(ctx, runs, size, options.tracking);
        const spacing = (size * options.tracking) / 1000;
        const text = runs.map((run) => run.value).join("");

        ctx.save();

        ctx.font = this.getFont(size, runs[0]!.family);
        const metrics = ctx.measureText(text || "0");
        const baseline = options.y + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;

        ctx.fillStyle = options.colour;

        let x = options.x - totalWidth / 2;

        let drawnCharacters = 0;
        const totalCharacters = [...text].length;

        for (const run of runs) {
            ctx.font = this.getFont(size, run.family);

            for (const character of [...run.value]) {
                ctx.fillText(character, x, baseline);

                x += ctx.measureText(character).width;

                drawnCharacters++;

                if (drawnCharacters < totalCharacters) {
                    x += spacing;
                }
            }
        }

        ctx.restore();
    }

    private measureRuns(
        ctx: CanvasRenderingContext2D,
        runs: ReadonlyArray<ITextRun>,
        size: number,
        tracking: number,
    ): number {
        const spacing = (size * tracking) / 1000;
        let width = 0;
        let characters = 0;

        ctx.save();

        for (const run of runs) {
            ctx.font = this.getFont(size, run.family);

            for (const character of [...run.value]) {
                width += ctx.measureText(character).width;
                characters++;
            }
        }

        ctx.restore();

        return width + Math.max(0, characters - 1) * spacing;
    }

    //#endregion

    //#region Colour helpers

    private interpolateHex(start: string, end: string, progress: number): string {
        const a = this.parseHex(start);
        const b = this.parseHex(end);
        return this.rgbToHex({
            r: Math.round(a.r + (b.r - a.r) * progress),
            g: Math.round(a.g + (b.g - a.g) * progress),
            b: Math.round(a.b + (b.b - a.b) * progress),
        });
    }

    private parseHex(value: string): IRgb {
        const hex = value.replace("#", "");
        return {
            r: Number.parseInt(hex.slice(0, 2), 16),
            g: Number.parseInt(hex.slice(2, 4), 16),
            b: Number.parseInt(hex.slice(4, 6), 16),
        };
    }

    private rgbToHex(value: IRgb): string {
        return `#${[value.r, value.g, value.b].map((component) => component.toString(16).padStart(2, "0")).join("")}`;
    }

    //#endregion

    //#region Assets

    private getAsset(filePath: string): Promise<ICachedAsset> {
        let cached = this.assetCache.get(filePath);

        if (!cached) {
            cached = this.readAsset(filePath);
            this.assetCache.set(filePath, cached);
            cached.catch(() => {
                this.assetCache.delete(filePath);
            });
        }

        return cached;
    }

    private async readAsset(filePath: string): Promise<ICachedAsset> {
        const buffer = await readFile(filePath);
        const metadata = await sharp(buffer).metadata();
        if (!metadata.width || !metadata.height) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                `Unable to read scorepost asset dimensions: ${filePath}`,
            );
        }

        return {
            buffer,
            width: metadata.width,
            height: metadata.height,
        };
    }

    private getResizedAsset(filePath: string, width: number, height: number): Promise<Buffer> {
        const key = `${filePath}:${width}x${height}`;
        let cached = this.resizedAssetCache.get(key);

        if (!cached) {
            cached = this.resizeAsset(filePath, width, height);
            this.resizedAssetCache.set(key, cached);
            cached.catch(() => {
                this.resizedAssetCache.delete(key);
            });
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

    //#region Drawing helpers

    private roundedRect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        width: number,
        height: number,
        radius: number,
    ): void {
        const r = Math.min(
            radius,

            width / 2,

            height / 2,
        );

        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + width - r, y);

        ctx.quadraticCurveTo(x + width, y, x + width, y + r);

        ctx.lineTo(x + width, y + height - r);
        ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);

        ctx.lineTo(x + r, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - r);

        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);

        ctx.closePath();
    }

    //#endregion
}
