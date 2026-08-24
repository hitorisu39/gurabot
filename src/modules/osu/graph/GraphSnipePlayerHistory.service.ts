import { Import, Trace } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { GraphRendererService } from "./GraphRenderer.service";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { EGraphSize } from "@domain/osu/enums/Graph.enum";
import { graphColors } from "@domain/osu/configs/Graph.config";
import { SnipePlayerHistoryEntryDto } from "@domain/snipe/SnipePlayerHistory.dto";
import { Chart, ChartConfiguration, Plugin } from "chart.js";

interface IHistoryPoint {
    index: number;
    date: Date;
    count: number;
}

interface IHistoryChange {
    from: IHistoryPoint;
    to: IHistoryPoint;
    amount: number;
}

interface IHistoryStats {
    peak: IHistoryPoint;
    current: IHistoryPoint;
    biggestGain: IHistoryChange | null;
    biggestLoss: IHistoryChange | null;
}

export class GraphSnipePlayerHistoryService extends AbstractService {
    @Import() declare private readonly graphRendererService: GraphRendererService;

    @Trace()
    public async render(history: ReadonlyArray<SnipePlayerHistoryEntryDto>): Promise<Buffer> {
        const points = this.normalize(history);
        if (!points.length) {
            throw new Exception(EApplicationError.NOT_FOUND, "This player has no national #1 history.");
        }

        const stats = this.calculateStats(points);
        const configuration: ChartConfiguration<"line", Array<number>, string> = {
            type: "line",

            plugins: [this.createPlugin(stats)],

            data: {
                labels: points.map((point) => DateFormatter.monthDay(point.date)),

                datasets: [
                    {
                        label: "National #1s",
                        data: points.map((point) => point.count),

                        backgroundColor: graphColors.history.bg,
                        borderColor: graphColors.history.border,

                        borderWidth: 2,
                        fill: "start",
                        tension: 0.3,

                        pointRadius: 0,
                        pointHoverRadius: 0,
                        pointHitRadius: 0,
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
                        beginAtZero: false,
                        grace: "10%",

                        ticks: {
                            color: graphColors.tickText,
                            precision: 0,
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
                        type: "category",

                        ticks: {
                            color: graphColors.axisText,

                            font: {
                                size: 12,
                                weight: "bold",
                            },

                            autoSkip: true,
                            maxTicksLimit: 10,
                            maxRotation: 0,
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

    private normalize(history: ReadonlyArray<SnipePlayerHistoryEntryDto>): Array<IHistoryPoint> {
        return history
            .map((entry) => ({
                date: this.parseDate(entry.date),
                count: Math.max(0, Math.floor(Number(entry.count))),
            }))
            .filter(
                (
                    point,
                ): point is {
                    date: Date;
                    count: number;
                } => point.date !== null && Number.isFinite(point.count),
            )
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .map((point, index) => ({
                index,
                ...point,
            }));
    }

    private parseDate(value: string): Date | null {
        const match = /^(?<year>\d{4})-(?<month>\d{1,2})-(?<day>\d{1,2})$/.exec(value);

        if (!match?.groups) {
            return null;
        }

        const year = Number(match.groups.year);
        const month = Number(match.groups.month);
        const day = Number(match.groups.day);

        const date = new Date(Date.UTC(year, month - 1, day));

        return Number.isNaN(date.getTime()) ? null : date;
    }

    private calculateStats(points: ReadonlyArray<IHistoryPoint>): IHistoryStats {
        const current = points.at(-1);

        if (!current) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "Cannot calculate empty snipe history.");
        }

        let peak = points[0]!;
        let biggestGain: IHistoryChange | null = null;
        let biggestLoss: IHistoryChange | null = null;

        for (let index = 0; index < points.length; index++) {
            const point = points[index]!;

            if (point.count > peak.count) {
                peak = point;
            }

            if (index === 0) {
                continue;
            }

            const previous = points[index - 1]!;
            const difference = point.count - previous.count;

            if (difference > 0 && (biggestGain === null || difference > biggestGain.amount)) {
                biggestGain = {
                    from: previous,
                    to: point,
                    amount: difference,
                };
            }

            if (difference < 0 && (biggestLoss === null || -difference > biggestLoss.amount)) {
                biggestLoss = {
                    from: previous,
                    to: point,
                    amount: -difference,
                };
            }
        }

        return {
            peak,
            current,
            biggestGain,
            biggestLoss,
        };
    }

    private createPlugin(stats: IHistoryStats): Plugin<"line"> {
        return {
            id: "osu_graph_snipe_player_history",

            beforeDraw: (chart) => {
                const { ctx, width, height } = chart;

                ctx.save();

                ctx.fillStyle = graphColors.background;
                ctx.fillRect(0, 0, width, height);

                ctx.restore();
            },

            afterDatasetsDraw: (chart) => {
                this.drawPointMarker(chart, stats.peak, graphColors.positive);
                this.drawPointMarker(chart, stats.current, graphColors.accent);
            },

            afterDraw: (chart) => {
                this.drawHeader(chart, stats);
            },
        };
    }

    private drawPointMarker(chart: Chart<"line">, point: IHistoryPoint, color: string): void {
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;

        if (!xScale || !yScale) {
            return;
        }

        const { ctx } = chart;

        const x = xScale.getPixelForValue(point.index);
        const y = yScale.getPixelForValue(point.count);

        ctx.save();

        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);

        ctx.fillStyle = graphColors.background;
        ctx.fill();

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.restore();
    }

    private drawHeader(chart: Chart<"line">, stats: IHistoryStats): void {
        const { ctx, width } = chart;

        const gain = stats.biggestGain
            ? `Biggest gain: +${DiscordFormatter.number(stats.biggestGain.amount)}`
            : "Biggest gain: None";

        const loss = stats.biggestLoss
            ? `Biggest loss: -${DiscordFormatter.number(stats.biggestLoss.amount)}`
            : "Biggest loss: None";

        const text =
            `Peak: ${DiscordFormatter.number(stats.peak.count)}` +
            `  •  Current: ${DiscordFormatter.number(stats.current.count)}` +
            `  •  ${gain}` +
            `  •  ${loss}`;

        ctx.save();

        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = graphColors.text;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillText(text, width / 2, 25);

        ctx.restore();
    }
}
