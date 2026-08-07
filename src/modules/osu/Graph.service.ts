import { AbstractService } from "@/core/framework/AbstractService";
import { Trace } from "@/core/decorators";
import { HttpClient } from "@/http";
import { ISkillStrain } from "@domain/core/Calculator";
import { graphFallbackColor, graphStrainColors, graphStrainTargetCount } from "@domain/osu/configs/Graph.config";
import { GameMode } from "@generated/adapter/types";
import { ChartConfiguration, Plugin } from "chart.js";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { Image, loadImage } from "canvas";

interface IGraphPoint {
    x: number;
    y: number;
}

interface ILineSeries {
    label: string;
    points: Array<IGraphPoint>;
}

interface ITimelineGap {
    from: IGraphPoint;
    to: IGraphPoint;
}

export class GraphService extends AbstractService {
    private static readonly gapThresholdMs = 2_000;
    private static readonly gapFallDurationMs = 300;
    private static readonly gapRiseDurationMs = 75;

    declare private chartCanvas: ChartJSNodeCanvas;
    declare private http: HttpClient;

    public async init(): Promise<void> {
        this.http = new HttpClient(this.logger, { name: "OsuGraph" });

        this.chartCanvas = new ChartJSNodeCanvas({
            width: 900,
            height: 265,
            backgroundColour: "transparent",
        });
    }

    @Trace("osu_graph_strains")
    public async strains<M extends GameMode>(
        rawStrains: Array<ISkillStrain<M>>,
        mode: M,
        coverUrl: string,
    ): Promise<Buffer> {
        const coverImage = await this.loadCoverImage(coverUrl);
        const backgroundPlugin = this.createBackgroundPlugin(coverImage);

        const series = this.createStrainSeries(rawStrains);

        if (!series.length) {
            throw new Error("Calculator returned no valid timestamped strain points.");
        }

        if (mode === GameMode.Standard) {
            this.replaceNoSliderAimWithSliderAim(series);
        }

        const totalDuration = this.getTotalDuration(series);

        for (const entry of series) {
            const gaps = this.findTimelineGaps(entry.points, GraphService.gapThresholdMs);

            entry.points = this.downsampleMinMax(entry.points, graphStrainTargetCount);
            entry.points = this.applyTimelineGaps(
                entry.points,
                gaps,
                GraphService.gapFallDurationMs,
                GraphService.gapRiseDurationMs,
            );
        }

        const datasets = series.map((entry) => {
            const color = graphStrainColors[entry.label] ?? graphFallbackColor;

            return {
                label: entry.label,
                data: entry.points,
                backgroundColor: color.bg,
                borderColor: color.border,
                parsing: false as const,
                normalized: true,
                fill: true,
                spanGaps: false,
                tension: 0.18,
                pointRadius: 0,
                pointHoverRadius: 0,
                pointHitRadius: 0,
                borderWidth: 2,
            };
        });

        const configuration: ChartConfiguration<"line", Array<IGraphPoint>> = {
            type: "line",
            plugins: [backgroundPlugin],
            data: { datasets },
            options: {
                responsive: false,
                animation: false,
                plugins: {
                    legend: {
                        labels: {
                            color: "rgb(223, 223, 223)",
                            font: {
                                size: 20,
                                weight: "bold",
                            },
                        },
                    },
                },
                scales: {
                    y: {
                        min: 0,
                        ticks: {
                            display: false,
                        },
                        grid: {
                            color: "rgba(105, 105, 105, 0.5)",
                        },
                        border: {
                            display: false,
                        },
                    },
                    x: {
                        type: "linear",
                        min: 0,
                        max: Math.max(1, totalDuration),
                        ticks: {
                            color: "rgb(223, 223, 223)",
                            font: {
                                weight: "bold",
                                size: 18,
                            },
                            maxTicksLimit: 12,
                            maxRotation: 0,
                            callback: (value) => this.formatTimestamp(Number(value)),
                        },
                        grid: {
                            color: "rgb(223, 223, 223)",
                            drawOnChartArea: false,
                        },
                    },
                },
            },
        };

        return await this.chartCanvas.renderToBuffer(configuration);
    }

    //#region Series

    private createStrainSeries<M extends GameMode>(rawStrains: Array<ISkillStrain<M>>): Array<ILineSeries> {
        return rawStrains
            .map(
                (strain): ILineSeries => ({
                    label: this.normalizeSkillName(strain.skillName),
                    points: this.normalizePoints(
                        (strain.points ?? []).map((point) => ({
                            x: Number(point.timeMs),
                            y: Number(point.value),
                        })),
                    ),
                }),
            )
            .filter((entry) => entry.label.length > 0 && entry.points.length > 0);
    }

    private normalizePoints(points: ReadonlyArray<IGraphPoint>): Array<IGraphPoint> {
        const valuesByTime = new Map<number, number>();

        for (const point of points) {
            if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
                continue;
            }

            const x = Math.max(0, point.x);
            const y = Math.max(0, point.y);
            const current = valuesByTime.get(x);

            valuesByTime.set(x, current === undefined ? y : Math.max(current, y));
        }

        return Array.from(valuesByTime, ([x, y]) => ({ x, y })).sort((a, b) => a.x - b.x);
    }

    private normalizeSkillName(skillName: string): string {
        switch (skillName) {
            case "Stamina2":
                return "Stamina (Single color)";
            default:
                return skillName;
        }
    }

    private replaceNoSliderAimWithSliderAim(series: Array<ILineSeries>): void {
        const aim = series.find((entry) => entry.label === "Aim");
        const noSliderAimIndex = series.findIndex((entry) => entry.label === "AimNoSliders");

        if (!aim || noSliderAimIndex === -1) {
            return;
        }

        const noSliderAim = series[noSliderAimIndex]!;
        const noSliderValuesByTime = new Map(noSliderAim.points.map((point) => [point.x, point.y]));

        series[noSliderAimIndex] = {
            label: "Aim (Sliders)",
            points: aim.points.map((point) => ({
                x: point.x,
                y: Math.max(0, point.y - (noSliderValuesByTime.get(point.x) ?? 0)),
            })),
        };
    }

    private getTotalDuration(series: ReadonlyArray<ILineSeries>): number {
        return series.reduce((maximum, entry) => Math.max(maximum, entry.points.at(-1)?.x ?? 0), 0);
    }

    //#endregion

    //#region Timeline gaps

    private findTimelineGaps(points: ReadonlyArray<IGraphPoint>, thresholdMs: number): Array<ITimelineGap> {
        const gaps: Array<ITimelineGap> = [];

        for (let index = 1; index < points.length; index++) {
            const from = points[index - 1]!;
            const to = points[index]!;

            if (to.x - from.x > thresholdMs) {
                gaps.push({ from, to });
            }
        }

        return gaps;
    }

    private applyTimelineGaps(
        points: ReadonlyArray<IGraphPoint>,
        gaps: ReadonlyArray<ITimelineGap>,
        fallDurationMs: number,
        riseDurationMs: number,
    ): Array<IGraphPoint> {
        if (!gaps.length) {
            return [...points];
        }

        const result = [...points];

        for (const gap of gaps) {
            const fallEnd = Math.min(gap.from.x + fallDurationMs, gap.to.x);
            const riseStart = Math.max(fallEnd, gap.to.x - riseDurationMs);

            result.push(gap.from, {
                x: fallEnd,
                y: 0,
            });

            if (riseStart > fallEnd) {
                result.push({
                    x: riseStart,
                    y: 0,
                });
            }

            result.push(gap.to);
        }

        return this.sortAndDeduplicatePoints(result);
    }

    private sortAndDeduplicatePoints(points: ReadonlyArray<IGraphPoint>): Array<IGraphPoint> {
        const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
        const result: Array<IGraphPoint> = [];

        for (const point of sorted) {
            const previous = result.at(-1);

            if (previous?.x === point.x && previous.y === point.y) {
                continue;
            }

            result.push(point);
        }

        return result;
    }

    //#endregion

    //#region Downsampling

    private downsampleMinMax(points: ReadonlyArray<IGraphPoint>, maxPoints: number): Array<IGraphPoint> {
        if (points.length <= maxPoints) {
            return [...points];
        }

        if (maxPoints <= 1) {
            return [points[0]!];
        }

        if (maxPoints === 2) {
            return [points[0]!, points.at(-1)!];
        }

        if (maxPoints === 3) {
            let maximum = points[1]!;

            for (let index = 2; index < points.length - 1; index++) {
                if (points[index]!.y > maximum.y) {
                    maximum = points[index]!;
                }
            }

            return [points[0]!, maximum, points.at(-1)!];
        }

        const firstPoint = points[0]!;
        const lastPoint = points.at(-1)!;
        const result: Array<IGraphPoint> = [firstPoint];

        const bucketCount = Math.floor((maxPoints - 2) / 2);
        const interiorPointCount = points.length - 2;
        const bucketSize = interiorPointCount / bucketCount;

        for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex++) {
            const start = 1 + Math.floor(bucketIndex * bucketSize);
            const end = Math.min(points.length - 1, 1 + Math.floor((bucketIndex + 1) * bucketSize));

            if (start >= end) {
                continue;
            }

            let minimum = points[start]!;
            let maximum = points[start]!;

            for (let pointIndex = start + 1; pointIndex < end; pointIndex++) {
                const point = points[pointIndex]!;

                if (point.y < minimum.y) {
                    minimum = point;
                }

                if (point.y > maximum.y) {
                    maximum = point;
                }
            }

            if (minimum.x <= maximum.x) {
                result.push(minimum);

                if (maximum !== minimum) {
                    result.push(maximum);
                }
            } else {
                result.push(maximum);

                if (minimum !== maximum) {
                    result.push(minimum);
                }
            }
        }

        result.push(lastPoint);

        return result;
    }

    //#endregion

    //#region Background

    private async loadCoverImage(coverUrl: string): Promise<Image | null> {
        try {
            const imageBuffer = await this.http.get<Buffer>(coverUrl, {
                responseType: "arraybuffer",
            });

            return imageBuffer ? await loadImage(imageBuffer) : null;
        } catch {
            this.logger.warn(`Failed to load cover image for graph: ${coverUrl}`);
            return null;
        }
    }

    private createBackgroundPlugin(coverImage: Image | null): Plugin<"line"> {
        return {
            id: "osu_strain_graph_background",
            beforeDraw: (chart) => {
                if (!coverImage) {
                    return;
                }

                const { ctx, width, height } = chart;

                ctx.save();

                // @ts-ignore
                ctx.drawImage(coverImage, 0, 0, width, height);

                ctx.fillStyle = "rgba(0, 0, 0, 0.74)";
                ctx.fillRect(0, 0, width, height);
                ctx.restore();
            },
        };
    }

    //#endregion

    //#region Formatting

    private formatTimestamp(milliseconds: number): string {
        const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    //#endregion
}
