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

interface IScorePoint {
    timestamp: number;
    date: Date;
    rankedScore: number;
    totalScore: number;
}

interface IScoreStats {
    first: IScorePoint;
    latest: IScorePoint;

    rankedGained: number;
    totalGained: number;
}

export class GraphOsuTrackScoresService extends AbstractService {
    @Import() declare private readonly graphRendererService: GraphRendererService;

    @Trace()
    public async generate(history: ReadonlyArray<OsuTrackStatsHistoryDto>): Promise<Buffer> {
        const points = this.normalizeHistory(history);
        const stats = this.calculateStats(points);

        const rankedData: Array<IGraphPoint> = points.map((point) => ({
            x: point.timestamp,
            y: point.rankedScore,
        }));

        const totalData: Array<IGraphPoint> = points.map((point) => ({
            x: point.timestamp,
            y: point.totalScore,
        }));

        const configuration: ChartConfiguration<"line", Array<IGraphPoint>> = {
            type: "line",
            plugins: [this.createPlugin(stats)],
            data: {
                datasets: [
                    {
                        label: "Ranked score",
                        data: rankedData,
                        borderColor: graphColors.osutrack.scores.ranked,
                        borderWidth: 2,
                        fill: false,
                        tension: 0.18,
                        parsing: false,
                        normalized: true,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        pointHitRadius: 0,
                        spanGaps: false,
                    },
                    {
                        label: "Total score",
                        data: totalData,
                        borderColor: graphColors.osutrack.scores.total,
                        borderWidth: 2,
                        fill: false,
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
                        min: 0,
                        ticks: {
                            color: graphColors.tickText,
                            padding: 10,
                            font: {
                                size: 13,
                                weight: "bold",
                            },
                            callback: (value) => DiscordFormatter.number(Number(value)),
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

    private normalizeHistory(history: ReadonlyArray<OsuTrackStatsHistoryDto>): Array<IScorePoint> {
        const points: Array<IScorePoint> = [];

        for (const entry of history) {
            const date = new Date(entry.timestamp);

            const rankedScore = Number(entry.rankedScore);
            const totalScore = Number(entry.totalScore);

            if (
                Number.isNaN(date.getTime()) ||
                !Number.isFinite(rankedScore) ||
                !Number.isFinite(totalScore) ||
                rankedScore < 0 ||
                totalScore < 0
            ) {
                continue;
            }

            points.push({
                timestamp: date.getTime(),
                date,
                rankedScore,
                totalScore,
            });
        }

        points.sort((a, b) => a.timestamp - b.timestamp);

        if (!points.length) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                "osu!track returned no valid score history for this user.",
            );
        }

        return points;
    }

    private calculateStats(points: ReadonlyArray<IScorePoint>): IScoreStats {
        const first = points.at(0);
        const latest = points.at(-1);

        if (!first || !latest) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "Cannot calculate osu!track score statistics from an empty dataset.",
            );
        }

        return {
            first,
            latest,
            rankedGained: latest.rankedScore - first.rankedScore,
            totalGained: latest.totalScore - first.totalScore,
        };
    }

    //#endregion

    //#region Plugin

    private createPlugin(stats: IScoreStats): Plugin<"line"> {
        return {
            id: "osu_graph_osutrack_scores",

            beforeDraw: (chart) => {
                const { ctx, width, height } = chart;

                ctx.save();
                ctx.fillStyle = graphColors.background;
                ctx.fillRect(0, 0, width, height);
                ctx.restore();
            },

            afterDatasetsDraw: (chart) => {
                /*
                 * Only mark the latest values. Four first/latest markers
                 * across two cumulative datasets would add unnecessary
                 * visual noise.
                 */
                this.drawPointMarker(
                    chart,
                    stats.latest.timestamp,
                    stats.latest.rankedScore,
                    graphColors.osutrack.scores.ranked,
                    7,
                );
                this.drawPointMarker(
                    chart,
                    stats.latest.timestamp,
                    stats.latest.totalScore,
                    graphColors.osutrack.scores.total,
                    7,
                );
            },

            afterDraw: (chart) => {
                this.drawHeader(chart, stats);
            },
        };
    }

    private drawPointMarker(
        chart: Chart<"line">,
        timestamp: number,
        value: number,
        color: string,
        radius: number,
    ): void {
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;

        if (!xScale || !yScale) {
            return;
        }

        const x = xScale.getPixelForValue(timestamp);
        const y = yScale.getPixelForValue(value);

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

    private drawHeader(chart: Chart<"line">, stats: IScoreStats): void {
        const { ctx, width } = chart;

        ctx.save();

        ctx.font = "bold 13px sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        const y = 25;
        const gap = 30;
        const iconRadius = 6;
        const iconTextGap = 10;

        const rankedText =
            `Ranked: ${DiscordFormatter.number(stats.latest.rankedScore)}` +
            ` · ${DiscordFormatter.delta(stats.rankedGained)}`;

        const totalText =
            `Total: ${DiscordFormatter.number(stats.latest.totalScore)}` +
            ` · ${DiscordFormatter.delta(stats.totalGained)}`;

        const trackedText =
            `${DateFormatter.monthYear(stats.first.date)}` + `–${DateFormatter.monthYear(stats.latest.date)}`;

        const rankedWidth = ctx.measureText(rankedText).width;
        const totalWidth = ctx.measureText(totalText).width;
        const trackedWidth = ctx.measureText(trackedText).width;
        const iconWidth = iconRadius * 2;

        const headerWidth =
            iconWidth +
            iconTextGap +
            rankedWidth +
            gap +
            iconWidth +
            iconTextGap +
            totalWidth +
            gap +
            iconWidth +
            iconTextGap +
            trackedWidth;

        let x = Math.max(18, (width - headerWidth) / 2);

        // Ranked score
        this.drawLegendCircle(ctx, x + iconRadius, y, iconRadius, graphColors.osutrack.scores.ranked);

        x += iconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(rankedText, x, y);

        x += rankedWidth + gap;

        // Total score
        this.drawLegendCircle(ctx, x + iconRadius, y, iconRadius, graphColors.osutrack.scores.total);

        x += iconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(totalText, x, y);

        x += totalWidth + gap;

        // Tracked range
        this.drawLegendCircle(ctx, x + iconRadius, y, iconRadius, graphColors.axisText);

        x += iconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(trackedText, x, y);

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
