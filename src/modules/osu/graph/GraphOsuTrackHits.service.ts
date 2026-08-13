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

interface IHitPoint {
    timestamp: number;
    date: Date;

    count300: number;
    count100: number;
    count50: number;
}

interface IHitStats {
    first: IHitPoint;
    latest: IHitPoint;

    gained300: number;
    gained100: number;
    gained50: number;
}

export class GraphOsuTrackHitsService extends AbstractService {
    @Import() declare private readonly graphRendererService: GraphRendererService;

    @Trace()
    public async generate(history: ReadonlyArray<OsuTrackStatsHistoryDto>): Promise<Buffer> {
        const points = this.normalizeHistory(history);
        const stats = this.calculateStats(points);

        const count300Data: Array<IGraphPoint> = points.map((point) => ({
            x: point.timestamp,
            y: point.count300,
        }));

        const count100Data: Array<IGraphPoint> = points.map((point) => ({
            x: point.timestamp,
            y: point.count100,
        }));

        const count50Data: Array<IGraphPoint> = points.map((point) => ({
            x: point.timestamp,
            y: point.count50,
        }));

        const configuration: ChartConfiguration<"line", Array<IGraphPoint>> = {
            type: "line",
            plugins: [this.createPlugin(stats)],
            data: {
                datasets: [
                    {
                        label: "300s",
                        data: count300Data,
                        borderColor: graphColors.osutrack.hits.count300,
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
                        label: "100s",
                        data: count100Data,
                        borderColor: graphColors.osutrack.hits.count100,
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
                        label: "50s",
                        data: count50Data,
                        borderColor: graphColors.osutrack.hits.count50,
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
                            callback: (value) => DiscordFormatter.number(Math.round(Number(value))),
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

    private normalizeHistory(history: ReadonlyArray<OsuTrackStatsHistoryDto>): Array<IHitPoint> {
        const points: Array<IHitPoint> = [];

        for (const entry of history) {
            const date = new Date(entry.timestamp);

            const count300 = Number(entry.count300);
            const count100 = Number(entry.count100);
            const count50 = Number(entry.count50);

            if (
                Number.isNaN(date.getTime()) ||
                !Number.isFinite(count300) ||
                !Number.isFinite(count100) ||
                !Number.isFinite(count50) ||
                count300 < 0 ||
                count100 < 0 ||
                count50 < 0
            ) {
                continue;
            }

            points.push({
                timestamp: date.getTime(),
                date,

                count300,
                count100,
                count50,
            });
        }

        points.sort((a, b) => a.timestamp - b.timestamp);

        if (!points.length) {
            throw new Exception(EApplicationError.NOT_FOUND, "osu!track returned no valid hit history for this user.");
        }

        return points;
    }

    private calculateStats(points: ReadonlyArray<IHitPoint>): IHitStats {
        const first = points.at(0);
        const latest = points.at(-1);

        if (!first || !latest) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "Cannot calculate osu!track hit statistics from an empty dataset.",
            );
        }

        return {
            first,
            latest,
            gained300: latest.count300 - first.count300,
            gained100: latest.count100 - first.count100,
            gained50: latest.count50 - first.count50,
        };
    }

    //#endregion

    //#region Plugin

    private createPlugin(stats: IHitStats): Plugin<"line"> {
        return {
            id: "osu_graph_osutrack_hits",

            beforeDraw: (chart) => {
                const { ctx, width, height } = chart;

                ctx.save();
                ctx.fillStyle = graphColors.background;
                ctx.fillRect(0, 0, width, height);
                ctx.restore();
            },

            afterDatasetsDraw: (chart) => {
                this.drawPointMarker(
                    chart,
                    stats.latest.timestamp,
                    stats.latest.count300,
                    graphColors.osutrack.hits.count300,
                    7,
                );
                this.drawPointMarker(
                    chart,
                    stats.latest.timestamp,
                    stats.latest.count100,
                    graphColors.osutrack.hits.count100,
                    7,
                );
                this.drawPointMarker(
                    chart,
                    stats.latest.timestamp,
                    stats.latest.count50,
                    graphColors.osutrack.hits.count50,
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

    private drawHeader(chart: Chart<"line">, stats: IHitStats): void {
        const { ctx, width } = chart;

        ctx.save();

        ctx.font = "bold 13px sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        const y = 25;
        const gap = 30;
        const iconRadius = 6;
        const iconTextGap = 10;

        const count300Text =
            `300s: ${DiscordFormatter.number(stats.latest.count300)}` + ` · ${DiscordFormatter.delta(stats.gained300)}`;

        const count100Text =
            `100s: ${DiscordFormatter.number(stats.latest.count100)}` + ` · ${DiscordFormatter.delta(stats.gained100)}`;

        const count50Text =
            `50s: ${DiscordFormatter.number(stats.latest.count50)}` + ` · ${DiscordFormatter.delta(stats.gained50)}`;
        const count300Width = ctx.measureText(count300Text).width;
        const count100Width = ctx.measureText(count100Text).width;
        const count50Width = ctx.measureText(count50Text).width;
        const iconWidth = iconRadius * 2;

        const totalWidth =
            iconWidth +
            iconTextGap +
            count300Width +
            gap +
            iconWidth +
            iconTextGap +
            count100Width +
            gap +
            iconWidth +
            iconTextGap +
            count50Width;

        let x = Math.max(18, (width - totalWidth) / 2);

        // 300s
        this.drawLegendCircle(ctx, x + iconRadius, y, iconRadius, graphColors.osutrack.hits.count300);

        x += iconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(count300Text, x, y);

        x += count300Width + gap;

        // 100s
        this.drawLegendCircle(ctx, x + iconRadius, y, iconRadius, graphColors.osutrack.hits.count100);

        x += iconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(count100Text, x, y);

        x += count100Width + gap;

        // 50s
        this.drawLegendCircle(ctx, x + iconRadius, y, iconRadius, graphColors.osutrack.hits.count50);

        x += iconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(count50Text, x, y);

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
