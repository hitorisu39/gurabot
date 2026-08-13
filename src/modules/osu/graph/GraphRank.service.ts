import { AbstractService } from "@/core/framework/AbstractService";
import { Import, Trace } from "@/core/decorators";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { Chart, ChartConfiguration, Plugin } from "chart.js";
import { GraphRendererService } from "./GraphRenderer.service";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { EGraphSize } from "@domain/osu/enums/Graph.enum";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { graphColors } from "@domain/osu/configs/Graph.config";

interface IRankPoint {
    index: number;
    date: Date;
    rank: number | null;
}

interface IValidRankPoint {
    index: number;
    date: Date;
    rank: number;
}

interface IRankClimb {
    from: IValidRankPoint;
    to: IValidRankPoint;
    amount: number;
}

interface IRankStats {
    best: IValidRankPoint;
    worst: IValidRankPoint;
    biggestClimb: IRankClimb | null;
}

export class GraphRankService extends AbstractService {
    @Import() declare private readonly graphRendererService: GraphRendererService;

    @Trace()
    public async render(rawRanks: ReadonlyArray<number>, timestamp: number): Promise<Buffer> {
        const points = this.normalizeRanks(rawRanks, timestamp);
        const stats = this.calculateStats(points);

        const configuration: ChartConfiguration<"line", Array<number | null>, string> = {
            type: "line",
            plugins: [this.createPlugin(stats)],
            data: {
                labels: points.map((point) => DateFormatter.monthDay(point.date)),
                datasets: [
                    {
                        label: "Global rank",
                        data: points.map((point) => point.rank),

                        backgroundColor: graphColors.rank.bg,
                        borderColor: graphColors.rank.border,

                        borderWidth: 2,
                        fill: "start",
                        tension: 0.3,

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
                        // beginAtZero: true,
                        reverse: true,
                        grace: "5%",
                        ticks: {
                            color: graphColors.tickText,
                            precision: 0,
                            padding: 10,
                            font: {
                                size: 13,
                                weight: "bold",
                            },
                            callback: (value) => ProfileFormatter.rank(Number(value)),
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

    //#region Data

    private normalizeRanks(rawRanks: ReadonlyArray<number>, timestamp: number): Array<IRankPoint> {
        if (!rawRanks.length) {
            throw new Exception(EApplicationError.NOT_FOUND, "This user has no rank history.");
        }

        const endDate = this.startOfUtcDay(new Date(timestamp));
        const startDate = this.addDays(endDate, -(rawRanks.length - 1));

        return rawRanks.map((rawRank, index) => {
            const rank = Number(rawRank);

            return {
                index,
                date: this.addDays(startDate, index),
                /*
                 * #0 isn't a real rank. Keep the slot so dates don't shift,
                 * but make Chart.js break the line there.
                 */
                rank: Number.isFinite(rank) && rank > 0 ? Math.floor(rank) : null,
            };
        });
    }

    private calculateStats(points: ReadonlyArray<IRankPoint>): IRankStats {
        let best: IValidRankPoint | null = null;
        let worst: IValidRankPoint | null = null;

        let previous: IValidRankPoint | null = null;
        let biggestClimb: IRankClimb | null = null;

        for (const point of points) {
            if (point.rank === null) {
                previous = null;
                continue;
            }

            const current: IValidRankPoint = {
                index: point.index,
                date: point.date,
                rank: point.rank,
            };

            /*
             * Smaller rank number = better.
             * Strict comparisons make ties use the earliest occurrence.
             */
            if (best === null || current.rank < best.rank) {
                best = current;
            }

            if (worst === null || current.rank > worst.rank) {
                worst = current;
            }

            if (previous !== null) {
                const improvement = previous.rank - current.rank;

                if (improvement > 0 && (biggestClimb === null || improvement > biggestClimb.amount)) {
                    biggestClimb = {
                        from: previous,
                        to: current,
                        amount: improvement,
                    };
                }
            }

            previous = current;
        }

        if (best === null || worst === null) {
            throw new Exception(EApplicationError.NOT_FOUND, "This user has no valid rank history.");
        }

        return {
            best,
            worst,
            biggestClimb,
        };
    }

    //#endregion

    //#region Plugin

    private createPlugin(stats: IRankStats): Plugin<"line"> {
        return {
            id: "osu_graph_rank",

            beforeDraw: (chart) => {
                const { ctx, width, height } = chart;

                ctx.save();

                ctx.fillStyle = graphColors.background;
                ctx.fillRect(0, 0, width, height);

                ctx.restore();
            },

            afterDatasetsDraw: (chart) => {
                /*
                 * Draw the climb first so point markers sit above it.
                 */
                if (stats.biggestClimb) {
                    this.drawClimbSegment(chart, stats.biggestClimb);
                }

                /*
                 * Worst first in case best/worst happen to overlap.
                 */
                this.drawPointMarker(chart, stats.worst, graphColors.negative, 7);
                this.drawPointMarker(chart, stats.best, graphColors.positive, 8);
            },

            afterDraw: (chart) => {
                this.drawHeader(chart, stats);
            },
        };
    }

    private drawPointMarker(chart: Chart<"line">, point: IValidRankPoint, color: string, radius: number): void {
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;

        if (!xScale || !yScale) {
            return;
        }

        const { ctx } = chart;

        const x = xScale.getPixelForValue(point.index);
        const y = yScale.getPixelForValue(point.rank);

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

    private drawClimbSegment(chart: Chart<"line">, climb: IRankClimb): void {
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;

        if (!xScale || !yScale) {
            return;
        }

        const { ctx } = chart;

        const fromX = xScale.getPixelForValue(climb.from.index);
        const fromY = yScale.getPixelForValue(climb.from.rank);

        const toX = xScale.getPixelForValue(climb.to.index);
        const toY = yScale.getPixelForValue(climb.to.rank);

        ctx.save();

        /*
         * Teal overlay over the rank line for the strongest climb.
         */
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);

        ctx.strokeStyle = graphColors.accent;
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.stroke();

        /*
         * Small endpoints make it obvious we're highlighting a segment,
         * not another dataset.
         */
        for (const [x, y] of [
            [fromX, fromY],
            [toX, toY],
        ] as const) {
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);

            ctx.fillStyle = graphColors.background;
            ctx.fill();

            ctx.strokeStyle = graphColors.accent;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.restore();
    }

    private drawHeader(chart: Chart<"line">, stats: IRankStats): void {
        const { ctx, width } = chart;

        ctx.save();

        ctx.font = "bold 13px sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        const y = 25;

        const gap = 30;
        const iconRadius = 6;
        const iconTextGap = 10;

        const bestText =
            `Best: #${DiscordFormatter.number(stats.best.rank)}` + ` · ${DateFormatter.monthDay(stats.best.date)}`;

        const worstText =
            `Worst: #${DiscordFormatter.number(stats.worst.rank)}` + ` · ${DateFormatter.monthDay(stats.worst.date)}`;

        const climbText = stats.biggestClimb
            ? `Biggest climb: +${DiscordFormatter.number(stats.biggestClimb.amount)}`
            : "Biggest climb: None";

        const bestWidth = ctx.measureText(bestText).width;
        const worstWidth = ctx.measureText(worstText).width;
        const climbWidth = ctx.measureText(climbText).width;

        const circleIconWidth = iconRadius * 2;
        const climbIconWidth = 22;

        const bestItemWidth = circleIconWidth + iconTextGap + bestWidth;
        const worstItemWidth = circleIconWidth + iconTextGap + worstWidth;
        const climbItemWidth = climbIconWidth + iconTextGap + climbWidth;
        const totalWidth = bestItemWidth + gap + worstItemWidth + gap + climbItemWidth;

        let x = Math.max(18, (width - totalWidth) / 2);

        // Best
        this.drawLegendCircle(ctx, x + iconRadius, y, iconRadius, graphColors.positive);

        x += circleIconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(bestText, x, y);

        x += bestWidth + gap;

        // Worst
        this.drawLegendCircle(ctx, x + iconRadius, y, iconRadius, graphColors.negative);

        x += circleIconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(worstText, x, y);

        x += worstWidth + gap;

        // Biggest climb
        this.drawClimbLegendIcon(ctx, x, y, climbIconWidth);

        x += climbIconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(climbText, x, y);

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

    private drawClimbLegendIcon(ctx: CanvasRenderingContext2D, x: number, y: number, width: number): void {
        ctx.save();

        const left = x;
        const right = x + width;

        const bottom = y + 5;
        const top = y - 5;

        ctx.beginPath();
        ctx.moveTo(left, bottom);
        ctx.lineTo(right, top);

        ctx.strokeStyle = graphColors.accent;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(left, bottom, 2.5, 0, Math.PI * 2);
        ctx.arc(right, top, 2.5, 0, Math.PI * 2);

        ctx.fillStyle = graphColors.accent;
        ctx.fill();

        ctx.restore();
    }

    //#endregion

    //#region Dates

    private startOfUtcDay(date: Date): Date {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    }

    private addDays(date: Date, amount: number): Date {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + amount));
    }

    //#endregion
}
