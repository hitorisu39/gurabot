import { AbstractService } from "@/core/framework/AbstractService";
import { Import, Trace } from "@/core/decorators";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { Chart, ChartConfiguration, Plugin } from "chart.js";
import { Score } from "@generated/adapter/types";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { graphColors } from "@domain/osu/configs/Graph.config";
import { GraphRendererService } from "./GraphRenderer.service";
import { EGraphSize } from "@domain/osu/enums/Graph.enum";

interface IRankedDateRecord {
    rankedDate: Date;
    scoreDate: Date | null;
}

interface IRankedDatePoint {
    index: number;
    year: number;
    count: number;
}

interface IRankedDateStats {
    oldest: Date;
    newest: Date;
    oldestYearIndex: number;
    newestYearIndex: number;

    favorite: IRankedDatePoint;

    medianMapAge: number | null;
}

export class GraphTopRankedDateService extends AbstractService {
    @Import()
    declare private readonly graphRendererService: GraphRendererService;

    @Trace()
    public async generate(scores: ReadonlyArray<Score>): Promise<Buffer> {
        const records = this.normalizeScores(scores);

        if (!records.length) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                "None of this user's top plays have ranked date information.",
            );
        }

        const points = this.buildPoints(records);
        const stats = this.calculateStats(records, points);

        const backgroundColors = points.map((point) =>
            point.index === stats.favorite.index ? graphColors.accent : graphColors.top.rankedDate.bg,
        );

        const borderColors = points.map((point) => {
            /*
             * Endpoint semantics win if favorite year overlaps
             * with oldest/newest.
             */
            if (point.index === stats.newestYearIndex) {
                return graphColors.positive;
            }

            if (point.index === stats.oldestYearIndex) {
                return graphColors.secondary;
            }

            if (point.index === stats.favorite.index) {
                return graphColors.accent;
            }

            return graphColors.top.rankedDate.border;
        });

        const configuration: ChartConfiguration<"bar", Array<number>, string> = {
            type: "bar",
            plugins: [this.createPlugin(stats)],
            data: {
                labels: points.map((point) => point.year.toString()),
                datasets: [
                    {
                        label: "Top plays",
                        data: points.map((point) => point.count),
                        backgroundColor: backgroundColors,
                        borderColor: borderColors,
                        borderWidth: 2,
                        borderRadius: 4,
                        barPercentage: 0.84,
                        categoryPercentage: 0.9,
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
                                size: 12,
                                weight: "bold",
                            },
                            autoSkip: true,
                            maxTicksLimit: 14,
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

    private normalizeScores(scores: ReadonlyArray<Score>): Array<IRankedDateRecord> {
        const records: Array<IRankedDateRecord> = [];

        for (const score of scores) {
            const rankedDateValue = score.beatmapset?.rankedDate;

            if (!rankedDateValue) {
                continue;
            }

            const rankedDate = new Date(rankedDateValue);
            if (Number.isNaN(rankedDate.getTime())) {
                continue;
            }

            const scoreDate = new Date(score.endedAt);

            records.push({
                rankedDate,
                scoreDate: Number.isNaN(scoreDate.getTime()) ? null : scoreDate,
            });
        }

        records.sort((a, b) => a.rankedDate.getTime() - b.rankedDate.getTime());
        return records;
    }

    private buildPoints(records: ReadonlyArray<IRankedDateRecord>): Array<IRankedDatePoint> {
        const first = records.at(0);
        const last = records.at(-1);

        if (!first || !last) {
            return [];
        }

        const firstYear = first.rankedDate.getUTCFullYear();
        const lastYear = last.rankedDate.getUTCFullYear();
        const countsByYear = new Map<number, number>();

        for (const record of records) {
            const year = record.rankedDate.getUTCFullYear();

            countsByYear.set(year, (countsByYear.get(year) ?? 0) + 1);
        }

        const points: Array<IRankedDatePoint> = [];

        let index = 0;

        for (let year = firstYear; year <= lastYear; year++) {
            points.push({
                index,
                year,
                count: countsByYear.get(year) ?? 0,
            });

            index++;
        }

        return points;
    }

    //#endregion

    //#region Statistics

    private calculateStats(
        records: ReadonlyArray<IRankedDateRecord>,
        points: ReadonlyArray<IRankedDatePoint>,
    ): IRankedDateStats {
        const firstRecord = records.at(0);
        const lastRecord = records.at(-1);

        const firstPoint = points.at(0);
        const lastPoint = points.at(-1);

        if (!firstRecord || !lastRecord || !firstPoint || !lastPoint) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "Cannot calculate ranked date statistics from an empty dataset.",
            );
        }

        let favorite = firstPoint;

        for (const point of points) {
            if (point.count > favorite.count) {
                favorite = point;
            }
        }

        const mapAges = records
            .map((record) => {
                if (!record.scoreDate) {
                    return null;
                }

                const age = record.scoreDate.getTime() - record.rankedDate.getTime();
                if (!Number.isFinite(age) || age < 0) {
                    return null;
                }

                return age;
            })
            .filter((age): age is number => age !== null)
            .sort((a, b) => a - b);

        return {
            oldest: firstRecord.rankedDate,
            newest: lastRecord.rankedDate,
            oldestYearIndex: firstPoint.index,
            newestYearIndex: lastPoint.index,
            favorite,
            medianMapAge: this.median(mapAges),
        };
    }

    private median(values: ReadonlyArray<number>): number | null {
        if (!values.length) {
            return null;
        }

        const middle = Math.floor(values.length / 2);

        const upper = values.at(middle);

        if (upper === undefined) {
            return null;
        }

        if (values.length % 2 === 1) {
            return upper;
        }

        const lower = values.at(middle - 1);

        if (lower === undefined) {
            return upper;
        }

        return (lower + upper) / 2;
    }

    //#endregion

    //#region Plugin

    private createPlugin(stats: IRankedDateStats): Plugin<"bar"> {
        return {
            id: "osu_graph_top_ranked_date",

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

    private drawHeader(chart: Chart<"bar">, stats: IRankedDateStats): void {
        const { ctx, width } = chart;
        ctx.save();

        ctx.font = "bold 13px sans-serif";

        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        const y = 25;

        const gap = 24;
        const iconWidth = 14;
        const iconTextGap = 8;

        const oldestText = `Oldest: ${DateFormatter.monthYear(stats.oldest)}`;

        const newestText = `Newest: ${DateFormatter.monthYear(stats.newest)}`;

        const favoriteText =
            `Favorite: ${stats.favorite.year}` + ` · ${DiscordFormatter.number(stats.favorite.count)} plays`;

        const ageText = `Median age: ${
            stats.medianMapAge !== null ? DateFormatter.duration(stats.medianMapAge) : "N/A"
        }`;

        const oldestWidth = ctx.measureText(oldestText).width;
        const newestWidth = ctx.measureText(newestText).width;
        const favoriteWidth = ctx.measureText(favoriteText).width;
        const ageWidth = ctx.measureText(ageText).width;

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
            favoriteWidth +
            gap +
            iconWidth +
            iconTextGap +
            ageWidth;

        let x = Math.max(14, (width - totalWidth) / 2);

        /*
         * Oldest map.
         */
        this.drawLegendBar(ctx, x, y, iconWidth, graphColors.secondary);
        x += iconWidth + iconTextGap;
        ctx.fillStyle = graphColors.text;
        ctx.fillText(oldestText, x, y);
        x += oldestWidth + gap;

        /*
         * Newest map.
         */
        this.drawLegendBar(ctx, x, y, iconWidth, graphColors.positive);
        x += iconWidth + iconTextGap;
        ctx.fillStyle = graphColors.text;
        ctx.fillText(newestText, x, y);
        x += newestWidth + gap;

        /*
         * Favorite ranked year.
         */
        this.drawLegendBar(ctx, x, y, iconWidth, graphColors.accent);
        x += iconWidth + iconTextGap;
        ctx.fillStyle = graphColors.text;
        ctx.fillText(favoriteText, x, y);
        x += favoriteWidth + gap;

        /*
         * Median map age.
         */
        this.drawLegendBar(ctx, x, y, iconWidth, graphColors.top.rankedDate.border);
        x += iconWidth + iconTextGap;
        ctx.fillStyle = graphColors.text;
        ctx.fillText(ageText, x, y);
        ctx.restore();
    }

    private drawLegendBar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, color: string): void {
        ctx.save();
        ctx.fillStyle = color;
        ctx.fillRect(x, y - 5, width, 10);
        ctx.restore();
    }

    //#endregion
}
