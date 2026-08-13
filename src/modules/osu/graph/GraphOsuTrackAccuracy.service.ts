import { AbstractService } from "@/core/framework/AbstractService";
import { Import, Trace } from "@/core/decorators";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { Chart, ChartConfiguration, Plugin } from "chart.js";
import { GraphRendererService } from "./GraphRenderer.service";
import { EGraphSize } from "@domain/osu/enums/Graph.enum";
import { graphColors } from "@domain/osu/configs/Graph.config";
import { OsuTrackStatsHistoryDto } from "@domain/osutrack/OsuTrack.dto";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";

interface IGraphPoint {
    x: number;
    y: number;
}

interface IAccuracyPoint {
    timestamp: number;
    date: Date;
    accuracy: number;
}

interface IAccuracyStats {
    first: IAccuracyPoint;
    peak: IAccuracyPoint;
    latest: IAccuracyPoint;
}

interface IAccuracyBounds {
    min: number;
    max: number;
}

export class GraphOsuTrackAccuracyService extends AbstractService {
    @Import() declare private readonly graphRendererService: GraphRendererService;

    @Trace()
    public async generate(history: ReadonlyArray<OsuTrackStatsHistoryDto>): Promise<Buffer> {
        const points = this.normalizeHistory(history);
        const stats = this.calculateStats(points);
        const bounds = this.calculateBounds(points);

        const data: Array<IGraphPoint> = points.map((point) => ({
            x: point.timestamp,
            y: point.accuracy,
        }));

        const configuration: ChartConfiguration<"line", Array<IGraphPoint>> = {
            type: "line",
            plugins: [this.createPlugin(stats)],
            data: {
                datasets: [
                    {
                        label: "Accuracy",
                        data,
                        backgroundColor: graphColors.osutrack.accuracy.bg,
                        borderColor: graphColors.osutrack.accuracy.border,
                        borderWidth: 2,
                        fill: "start",
                        tension: 0.18,
                        parsing: false,
                        normalized: true,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        pointHitRadius: 0,
                        spanGaps: false,
                    },
                ],
            },
            options: {
                responsive: false,
                animation: false,
                layout: {
                    padding: {
                        top: 58,
                        left: 12,
                        right: 12,
                        bottom: 4,
                    },
                },
                plugins: {
                    legend: {
                        display: false,
                    },
                },
                scales: {
                    y: {
                        min: bounds.min,
                        max: bounds.max,
                        ticks: {
                            color: graphColors.tickText,
                            padding: 10,
                            font: {
                                size: 13,
                                weight: "bold",
                            },
                            callback: (value) => `${Number(value).toFixed(2)}%`,
                        },
                        grid: {
                            color: graphColors.grid,
                        },
                        border: {
                            display: false,
                        },
                    },
                    x: {
                        type: "linear",
                        min: points.at(0)?.timestamp,
                        max: points.at(-1)?.timestamp,
                        ticks: {
                            color: graphColors.axisText,
                            font: {
                                size: 12,
                                weight: "bold",
                            },
                            maxTicksLimit: 10,
                            maxRotation: 0,
                            callback: (value) => DateFormatter.monthYear(new Date(Number(value))),
                        },
                        grid: {
                            color: graphColors.axisText,
                            drawOnChartArea: false,
                        },
                        border: {
                            display: false,
                        },
                    },
                },
            },
        };

        return await this.graphRendererService.render(EGraphSize.Standard, configuration);
    }

    //#region Data

    private normalizeHistory(history: ReadonlyArray<OsuTrackStatsHistoryDto>): Array<IAccuracyPoint> {
        const points: Array<IAccuracyPoint> = [];

        for (const entry of history) {
            const date = new Date(entry.timestamp);
            const accuracy = Number(entry.accuracy);

            if (Number.isNaN(date.getTime()) || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) {
                continue;
            }

            points.push({
                timestamp: date.getTime(),
                date,
                accuracy,
            });
        }

        points.sort((a, b) => a.timestamp - b.timestamp);

        if (!points.length) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                "osu!track returned no valid accuracy history for this user.",
            );
        }

        return points;
    }

    private calculateStats(points: ReadonlyArray<IAccuracyPoint>): IAccuracyStats {
        const first = points.at(0);
        const latest = points.at(-1);

        if (!first || !latest) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "Cannot calculate osu!track accuracy statistics from an empty dataset.",
            );
        }

        let peak = first;

        for (const point of points) {
            /*
             * Strict comparison means ties keep the earliest occurrence.
             */
            if (point.accuracy > peak.accuracy) {
                peak = point;
            }
        }

        return {
            first,
            peak,
            latest,
        };
    }

    private calculateBounds(points: ReadonlyArray<IAccuracyPoint>): IAccuracyBounds {
        let lowest = Infinity;
        let highest = -Infinity;

        for (const point of points) {
            lowest = Math.min(lowest, point.accuracy);

            highest = Math.max(highest, point.accuracy);
        }

        if (!Number.isFinite(lowest) || !Number.isFinite(highest)) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "Cannot calculate osu!track accuracy bounds from an empty dataset.",
            );
        }

        const range = highest - lowest;

        /*
         * Give larger ranges proportional padding, while still making
         * tiny changes visible when the user's accuracy barely moved.
         */
        const padding = range > 0 ? Math.max(range * 0.15, 0.05) : 0.1;
        let min = Math.max(0, lowest - padding);
        let max = Math.min(100, highest + padding);

        /*
         * Avoid a degenerate scale at exactly 0% or 100%.
         */
        if (min === max) {
            min = Math.max(0, min - 0.1);
            max = Math.min(100, max + 0.1);
        }

        return {
            min,
            max,
        };
    }

    //#endregion

    //#region Plugin

    private createPlugin(stats: IAccuracyStats): Plugin<"line"> {
        return {
            id: "osu_graph_osutrack_accuracy",

            beforeDraw: (chart) => {
                const { ctx, width, height } = chart;

                ctx.save();

                ctx.fillStyle = graphColors.background;

                ctx.fillRect(0, 0, width, height);

                ctx.restore();
            },

            afterDatasetsDraw: (chart) => {
                /*
                 * Peak wins visually if it overlaps an endpoint.
                 */
                this.drawPointMarker(chart, stats.first, graphColors.secondary, 7);
                this.drawPointMarker(chart, stats.latest, graphColors.accent, 7);
                this.drawPointMarker(chart, stats.peak, graphColors.positive, 8);
            },

            afterDraw: (chart) => {
                this.drawHeader(chart, stats);
            },
        };
    }

    private drawPointMarker(chart: Chart<"line">, point: IAccuracyPoint, color: string, radius: number): void {
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;

        if (!xScale || !yScale) {
            return;
        }

        const x = xScale.getPixelForValue(point.timestamp);

        const y = yScale.getPixelForValue(point.accuracy);

        const { ctx } = chart;

        ctx.save();

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);

        ctx.fillStyle = graphColors.background;

        ctx.fill();

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.restore();
    }

    private drawHeader(chart: Chart<"line">, stats: IAccuracyStats): void {
        const { ctx, width } = chart;

        ctx.save();

        ctx.font = "bold 13px sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        const y = 25;
        const gap = 30;
        const iconRadius = 6;
        const iconTextGap = 10;

        const firstText =
            `First: ${ProfileFormatter.accuracy(stats.first.accuracy)}` +
            ` · ${DateFormatter.monthYear(stats.first.date)}`;

        const peakText =
            `Peak: ${ProfileFormatter.accuracy(stats.peak.accuracy)}` +
            ` · ${DateFormatter.monthYear(stats.peak.date)}`;

        const latestText =
            `Latest: ${ProfileFormatter.accuracy(stats.latest.accuracy)}` +
            ` · ${DateFormatter.monthYear(stats.latest.date)}`;

        const firstWidth = ctx.measureText(firstText).width;
        const peakWidth = ctx.measureText(peakText).width;
        const latestWidth = ctx.measureText(latestText).width;
        const iconWidth = iconRadius * 2;

        const totalWidth =
            iconWidth +
            iconTextGap +
            firstWidth +
            gap +
            iconWidth +
            iconTextGap +
            peakWidth +
            gap +
            iconWidth +
            iconTextGap +
            latestWidth;

        let x = Math.max(18, (width - totalWidth) / 2);

        // First
        this.drawLegendCircle(ctx, x + iconRadius, y, iconRadius, graphColors.secondary);

        x += iconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(firstText, x, y);

        x += firstWidth + gap;

        // Peak
        this.drawLegendCircle(ctx, x + iconRadius, y, iconRadius, graphColors.positive);

        x += iconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(peakText, x, y);

        x += peakWidth + gap;

        // Latest
        this.drawLegendCircle(ctx, x + iconRadius, y, iconRadius, graphColors.accent);

        x += iconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;

        ctx.fillText(latestText, x, y);
        ctx.restore();
    }

    private drawLegendCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
        ctx.save();

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);

        ctx.fillStyle = graphColors.background;

        ctx.fill();

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }

    //#endregion
}
