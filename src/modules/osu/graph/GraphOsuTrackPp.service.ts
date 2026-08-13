import { AbstractService } from "@/core/framework/AbstractService";
import { Import, Trace } from "@/core/decorators";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { Chart, ChartConfiguration, Plugin } from "chart.js";
import { GraphRendererService } from "./GraphRenderer.service";
import { EGraphSize } from "@domain/osu/enums/Graph.enum";
import { graphColors } from "@domain/osu/configs/Graph.config";
import { OsuTrackStatsHistoryDto } from "@domain/osutrack/OsuTrack.dto";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";

interface IGraphPoint {
    x: number;
    y: number;
}

interface IPpPoint {
    timestamp: number;
    date: Date;
    pp: number;
}

interface IPpStats {
    first: IPpPoint;
    peak: IPpPoint;
    latest: IPpPoint;
}

export class GraphOsuTrackPpService extends AbstractService {
    @Import() declare private readonly graphRendererService: GraphRendererService;

    @Trace()
    public async generate(history: ReadonlyArray<OsuTrackStatsHistoryDto>): Promise<Buffer> {
        const points = this.normalizeHistory(history);
        const stats = this.calculateStats(points);

        const data: Array<IGraphPoint> = points.map((point) => ({
            x: point.timestamp,
            y: point.pp,
        }));

        const configuration: ChartConfiguration<"line", Array<IGraphPoint>> = {
            type: "line",
            plugins: [this.createPlugin(stats)],
            data: {
                datasets: [
                    {
                        label: "Performance points",
                        data,
                        backgroundColor: graphColors.osutrack.pp.bg,
                        borderColor: graphColors.osutrack.pp.border,
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
                        grace: "5%",
                        ticks: {
                            color: graphColors.tickText,
                            padding: 10,
                            font: {
                                size: 13,
                                weight: "bold",
                            },
                            callback: (value) => `${DiscordFormatter.number(Number(value))}pp`,
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

    private normalizeHistory(history: ReadonlyArray<OsuTrackStatsHistoryDto>): Array<IPpPoint> {
        const points: Array<IPpPoint> = [];

        for (const entry of history) {
            const date = new Date(entry.timestamp);
            const pp = Number(entry.pp);

            if (Number.isNaN(date.getTime()) || !Number.isFinite(pp) || pp < 0) {
                continue;
            }

            points.push({
                timestamp: date.getTime(),
                date,
                pp,
            });
        }

        points.sort((a, b) => a.timestamp - b.timestamp);

        if (!points.length) {
            throw new Exception(EApplicationError.NOT_FOUND, "osu!track returned no valid PP history for this user.");
        }

        return points;
    }

    private calculateStats(points: ReadonlyArray<IPpPoint>): IPpStats {
        const first = points.at(0);
        const latest = points.at(-1);

        if (!first || !latest) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "Cannot calculate osu!track PP statistics from an empty dataset.",
            );
        }

        let peak = first;

        for (const point of points) {
            /*
             * Strict comparison keeps the earliest occurrence in case
             * the same peak value appears multiple times.
             */
            if (point.pp > peak.pp) {
                peak = point;
            }
        }

        return {
            first,
            peak,
            latest,
        };
    }

    //#endregion

    //#region Plugin

    private createPlugin(stats: IPpStats): Plugin<"line"> {
        return {
            id: "osu_graph_osutrack_pp",

            beforeDraw: (chart) => {
                const { ctx, width, height } = chart;

                ctx.save();

                ctx.fillStyle = graphColors.background;
                ctx.fillRect(0, 0, width, height);

                ctx.restore();
            },

            afterDatasetsDraw: (chart) => {
                /*
                 * Draw first/latest before peak so the peak marker wins
                 * if it occupies the same snapshot as either of them.
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

    private drawPointMarker(chart: Chart<"line">, point: IPpPoint, color: string, radius: number): void {
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;

        if (!xScale || !yScale) {
            return;
        }

        const x = xScale.getPixelForValue(point.timestamp);
        const y = yScale.getPixelForValue(point.pp);

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

    private drawHeader(chart: Chart<"line">, stats: IPpStats): void {
        const { ctx, width } = chart;

        ctx.save();

        ctx.font = "bold 13px sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        const y = 25;
        const gap = 30;
        const iconRadius = 6;
        const iconTextGap = 10;

        const firstText = `First: ${this.formatPp(stats.first.pp)}` + ` · ${DateFormatter.monthYear(stats.first.date)}`;
        const peakText = `Peak: ${this.formatPp(stats.peak.pp)}` + ` · ${DateFormatter.monthYear(stats.peak.date)}`;
        const latestText =
            `Latest: ${this.formatPp(stats.latest.pp)}` + ` · ${DateFormatter.monthYear(stats.latest.date)}`;

        const firstWidth = ctx.measureText(firstText).width;
        const peakWidth = ctx.measureText(peakText).width;
        const latestWidth = ctx.measureText(latestText).width;

        const iconWidth = iconRadius * 2;

        const firstItemWidth = iconWidth + iconTextGap + firstWidth;
        const peakItemWidth = iconWidth + iconTextGap + peakWidth;
        const latestItemWidth = iconWidth + iconTextGap + latestWidth;

        const totalWidth = firstItemWidth + gap + peakItemWidth + gap + latestItemWidth;

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

    //#region Formatting

    private formatPp(value: number): string {
        return `${DiscordFormatter.number(Math.round(value))}pp`;
    }

    //#endregion
}
