import { AbstractService } from "@/core/framework/AbstractService";
import { Import, Trace } from "@/core/decorators";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ChartConfiguration, Plugin } from "chart.js";
import { Score } from "@generated/adapter/types";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { graphColors } from "@domain/osu/configs/Graph.config";
import { GraphRendererService } from "./GraphRenderer.service";
import { EGraphSize } from "@domain/osu/enums/Graph.enum";

interface IAgePoint {
    index: number;
    date: Date;
    count: number;
}

interface IAgeStats {
    oldest: Date;
    newest: Date;

    oldestMonthIndex: number;
    newestMonthIndex: number;

    busiest: IAgePoint;
}

export class GraphTopAgeService extends AbstractService {
    @Import() declare private readonly graphRendererService: GraphRendererService;

    @Trace()
    public async generate(scores: ReadonlyArray<Score>, timestamp: number = Date.now()): Promise<Buffer> {
        const result = this.normalizeScores(scores, timestamp);

        const { points, oldest, newest, oldestMonthIndex, newestMonthIndex } = result;

        const stats = this.calculateStats(points, oldest, newest, oldestMonthIndex, newestMonthIndex);

        const backgroundColors = points.map((point) =>
            point.index === stats.busiest.index ? graphColors.accent : graphColors.top.age.bg,
        );

        const borderColors = points.map((point) => {
            /*
             * Endpoint semantics win over busiest-month styling
             * if one of those happens to overlap.
             */
            if (point.index === stats.newestMonthIndex) {
                return graphColors.positive;
            }

            if (point.index === stats.oldestMonthIndex) {
                return graphColors.secondary;
            }

            if (point.index === stats.busiest.index) {
                return graphColors.accent;
            }

            return graphColors.top.age.border;
        });

        const configuration: ChartConfiguration<"bar", Array<number>, string> = {
            type: "bar",
            plugins: [this.createPlugin(stats)],
            data: {
                labels: points.map((point) => DateFormatter.monthYear(point.date)),
                datasets: [
                    {
                        label: "Top plays set",
                        data: points.map((point) => point.count),
                        backgroundColor: backgroundColors,
                        borderColor: borderColors,
                        borderWidth: 2,
                        borderRadius: 3,
                        barPercentage: 0.92,
                        categoryPercentage: 0.96,
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
                        beginAtZero: true,
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
                                size: 11,
                                weight: "bold",
                            },
                            autoSkip: true,
                            maxTicksLimit: 12,
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

    private normalizeScores(
        scores: ReadonlyArray<Score>,
        timestamp: number,
    ): {
        points: Array<IAgePoint>;
        oldest: Date;
        newest: Date;
        oldestMonthIndex: number;
        newestMonthIndex: number;
    } {
        const dates = scores
            .map((score) => new Date(score.endedAt))
            .filter((date) => !Number.isNaN(date.getTime()))
            .sort((a, b) => a.getTime() - b.getTime());

        const oldest = dates.at(0);
        const newest = dates.at(-1);

        if (!oldest || !newest) {
            throw new Exception(EApplicationError.NOT_FOUND, "This user has no valid top play timestamps.");
        }

        const countsByMonth = new Map<number, number>();

        for (const date of dates) {
            const month = this.startOfUtcMonth(date);
            const key = month.getTime();

            countsByMonth.set(key, (countsByMonth.get(key) ?? 0) + 1);
        }

        const firstMonth = this.startOfUtcMonth(oldest);
        const newestMonth = this.startOfUtcMonth(newest);
        const requestedEnd = new Date(timestamp);

        const currentMonth = Number.isNaN(requestedEnd.getTime()) ? newestMonth : this.startOfUtcMonth(requestedEnd);
        const lastMonth = currentMonth.getTime() > newestMonth.getTime() ? currentMonth : newestMonth;

        const points: Array<IAgePoint> = [];

        let index = 0;

        for (let current = firstMonth; current.getTime() <= lastMonth.getTime(); current = this.addMonths(current, 1)) {
            points.push({
                index,
                date: current,
                count: countsByMonth.get(current.getTime()) ?? 0,
            });

            index++;
        }

        const newestMonthIndex = this.monthDifference(firstMonth, newestMonth);

        return {
            points,
            oldest,
            newest,
            oldestMonthIndex: 0,
            newestMonthIndex,
        };
    }

    private calculateStats(
        points: ReadonlyArray<IAgePoint>,
        oldest: Date,
        newest: Date,
        oldestMonthIndex: number,
        newestMonthIndex: number,
    ): IAgeStats {
        const firstPoint = points.at(0);

        if (!firstPoint) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "Cannot calculate top play age statistics from an empty dataset.",
            );
        }

        let busiest = firstPoint;

        for (const point of points) {
            /*
             * Strict comparison means ties use the earliest month.
             */
            if (point.count > busiest.count) {
                busiest = point;
            }
        }

        return {
            oldest,
            newest,
            oldestMonthIndex,
            newestMonthIndex,
            busiest,
        };
    }

    //#endregion

    //#region Plugin

    private createPlugin(stats: IAgeStats): Plugin<"bar"> {
        return {
            id: "osu_graph_top_age",

            beforeDraw: (chart) => {
                const { ctx, width, height } = chart;

                ctx.save();

                ctx.fillStyle = graphColors.background;
                ctx.fillRect(0, 0, width, height);

                ctx.restore();
            },

            afterDraw: (chart) => {
                this.drawHeader(chart, stats);
            },
        };
    }

    private drawHeader(chart: Parameters<NonNullable<Plugin<"bar">["afterDraw"]>>[0], stats: IAgeStats): void {
        const { ctx, width } = chart;

        ctx.save();

        ctx.font = "bold 13px sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        const y = 25;
        const gap = 30;
        const iconWidth = 16;
        const iconTextGap = 10;

        const oldestText = `Oldest: ${DateFormatter.monthYear(stats.oldest)}`;
        const newestText = `Newest: ${DateFormatter.monthYear(stats.newest)}`;
        const busiestText =
            `Busiest: ${DateFormatter.monthYear(stats.busiest.date)}` +
            ` · ${DiscordFormatter.number(stats.busiest.count)} plays`;

        const oldestWidth = ctx.measureText(oldestText).width;
        const newestWidth = ctx.measureText(newestText).width;
        const busiestWidth = ctx.measureText(busiestText).width;

        const totalWidth =
            iconWidth +
            iconTextGap +
            oldestWidth +
            gap +
            iconWidth +
            iconTextGap +
            newestWidth +
            gap +
            iconWidth +
            iconTextGap +
            busiestWidth;

        let x = Math.max(18, (width - totalWidth) / 2);

        this.drawLegendBar(ctx, x, y, iconWidth, graphColors.secondary);

        x += iconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(oldestText, x, y);

        x += oldestWidth + gap;

        this.drawLegendBar(ctx, x, y, iconWidth, graphColors.positive);

        x += iconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(newestText, x, y);

        x += newestWidth + gap;

        this.drawLegendBar(ctx, x, y, iconWidth, graphColors.accent);

        x += iconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(busiestText, x, y);

        ctx.restore();
    }

    private drawLegendBar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, color: string): void {
        ctx.save();

        ctx.fillStyle = color;
        ctx.fillRect(x, y - 5, width, 10);

        ctx.restore();
    }

    //#endregion

    //#region Dates

    private startOfUtcMonth(date: Date): Date {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    }

    private addMonths(date: Date, amount: number): Date {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
    }

    private monthDifference(start: Date, end: Date): number {
        return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
    }

    //#endregion
}
