import { AbstractService } from "@/core/framework/AbstractService";
import { Import, Trace } from "@/core/decorators";
import { HttpClient } from "@/http";
import { ISkillStrain } from "@domain/core/Calculator";
import { graphFallbackColor, graphStrainColors } from "@domain/osu/configs/Graph.config";
import { GameMode } from "@generated/adapter/types";
import { ChartConfiguration, Plugin } from "chart.js";
import { Image, loadImage } from "canvas";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { GraphRendererService } from "./GraphRenderer.service";
import { EGraphSize } from "@domain/osu/enums/Graph.enum";

interface IGraphPoint {
    x: number;
    y: number;
}

interface ILineSeries {
    label: string;
    points: Array<IGraphPoint>;
}

export class GraphStrainService extends AbstractService {
    @Import() declare private readonly graphRendererService: GraphRendererService;

    declare private http: HttpClient;

    public async init(): Promise<void> {
        this.http = new HttpClient(this.logger, { name: "OsuGraphStrain" });
    }

    @Trace()
    public async generate<M extends GameMode>(rawStrains: Array<ISkillStrain<M>>, coverUrl: string): Promise<Buffer> {
        const coverImage = await this.loadCoverImage(coverUrl);
        const backgroundPlugin = this.createBackgroundPlugin(coverImage);

        const series = this.createStrainSeries(rawStrains);

        if (!series.length) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "Calculator returned no valid timestamped strain points.",
            );
        }

        const totalDuration = this.getTotalDuration(series);
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

        return await this.graphRendererService.render(EGraphSize.Compact, configuration);
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

    private getTotalDuration(series: ReadonlyArray<ILineSeries>): number {
        return series.reduce((maximum, entry) => Math.max(maximum, entry.points.at(-1)?.x ?? 0), 0);
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
