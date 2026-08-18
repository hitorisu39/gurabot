import { AbstractService } from "@/core/framework/AbstractService";
import { Import, Trace } from "@/core/decorators";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { Chart, ChartConfiguration, Plugin } from "chart.js";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { graphColors } from "@domain/osu/configs/Graph.config";
import { GraphRendererService } from "./GraphRenderer.service";
import { EGraphSize } from "@domain/osu/enums/Graph.enum";

interface IAchievement {
    achievedAt: Date;
    achievementID: number;
}

interface IAchievementPoint {
    index: number;
    date: Date;
    count: number;
    total: number;
}

interface IAchievementStats {
    first: Date;
    latest: Date;
    total: number;
    bestMonth: IAchievementPoint;
}

export class GraphAchievementsService extends AbstractService {
    @Import() declare private readonly graphRendererService: GraphRendererService;

    @Trace()
    public async generate(rawAchievements: ReadonlyArray<IAchievement>): Promise<Buffer> {
        const points = this.normalizeAchievements(rawAchievements);

        if (!points.length) {
            throw new Exception(EApplicationError.NOT_FOUND, "This user has no achievements.");
        }

        const stats = this.calculateStats(rawAchievements, points);

        const configuration: ChartConfiguration<"line", Array<number>, string> = {
            type: "line",
            plugins: [this.createPlugin(stats)],

            data: {
                labels: points.map((point) => DateFormatter.monthYear(point.date)),
                datasets: [
                    {
                        label: "Achievements",
                        data: points.map((point) => point.total),
                        backgroundColor: graphColors.achievements.bg,
                        borderColor: graphColors.achievements.border,
                        borderWidth: 2,
                        fill: true,
                        stepped: "after",
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

    //#region Data normalization

    private normalizeAchievements(rawAchievements: ReadonlyArray<IAchievement>): Array<IAchievementPoint> {
        const countsByMonth = new Map<number, number>();

        for (const achievement of rawAchievements) {
            const date = new Date(achievement.achievedAt);

            if (Number.isNaN(date.getTime())) {
                continue;
            }

            const month = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
            countsByMonth.set(month, (countsByMonth.get(month) ?? 0) + 1);
        }

        const months = Array.from(countsByMonth.keys()).sort((a, b) => a - b);

        const firstTimestamp = months.at(0);
        const lastTimestamp = months.at(-1);

        if (firstTimestamp === undefined || lastTimestamp === undefined) {
            return [];
        }

        const firstMonth = new Date(firstTimestamp);
        const lastMonth = new Date(lastTimestamp);

        const points: Array<IAchievementPoint> = [];

        let total = 0;
        let index = 0;

        for (let current = firstMonth; current.getTime() <= lastMonth.getTime(); current = this.addMonths(current, 1)) {
            const count = countsByMonth.get(current.getTime()) ?? 0;

            total += count;

            points.push({
                index,
                date: current,
                count,
                total,
            });

            index++;
        }

        return points;
    }

    private addMonths(date: Date, amount: number): Date {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
    }

    //#endregion

    //#region Statistics

    private calculateStats(
        rawAchievements: ReadonlyArray<IAchievement>,
        points: ReadonlyArray<IAchievementPoint>,
    ): IAchievementStats {
        const achievementDates = rawAchievements
            .map((achievement) => new Date(achievement.achievedAt))
            .filter((date) => !Number.isNaN(date.getTime()))
            .sort((a, b) => a.getTime() - b.getTime());

        const first = achievementDates.at(0);
        const latest = achievementDates.at(-1);

        const firstPoint = points.at(0);
        const lastPoint = points.at(-1);

        if (!first || !latest || !firstPoint || !lastPoint) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "Cannot calculate achievement statistics from an empty dataset.",
            );
        }

        let bestMonth = firstPoint;

        for (const point of points) {
            if (point.count > bestMonth.count) {
                bestMonth = point;
            }
        }

        return {
            first,
            latest,
            total: lastPoint.total,
            bestMonth,
        };
    }

    //#endregion

    //#region Plugin

    private createPlugin(stats: IAchievementStats): Plugin<"line"> {
        return {
            id: "osu_graph_achievements",

            beforeDraw: (chart) => {
                const { ctx, width, height } = chart;

                ctx.save();

                ctx.fillStyle = graphColors.background;
                ctx.fillRect(0, 0, width, height);

                ctx.restore();
            },

            afterDatasetsDraw: (chart) => {
                this.drawPointMarker(chart, stats.bestMonth, graphColors.achievements.highlight, 7);
            },

            afterDraw: (chart) => {
                this.drawHeader(chart, stats);
            },
        };
    }

    private drawPointMarker(chart: Chart<"line">, point: IAchievementPoint, color: string, radius: number): void {
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;

        if (!xScale || !yScale) {
            return;
        }

        const { ctx } = chart;

        const x = xScale.getPixelForValue(point.index);
        const y = yScale.getPixelForValue(point.total);

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

    private drawHeader(chart: Chart<"line">, stats: IAchievementStats): void {
        const { ctx, width } = chart;

        ctx.save();

        ctx.font = "bold 13px sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        const y = 25;
        const gap = 30;
        const iconRadius = 6;
        const iconTextGap = 10;

        const firstText = `First: ${DateFormatter.monthDay(stats.first)}`;

        const latestText =
            `Latest: ${DateFormatter.monthDay(stats.latest)}` + ` • ${DiscordFormatter.number(stats.total)} total`;

        const bestMonthText =
            `Best month: ${DiscordFormatter.number(stats.bestMonth.count)}` +
            ` • ${DateFormatter.monthYear(stats.bestMonth.date)}`;

        const firstWidth = ctx.measureText(firstText).width;
        const latestWidth = ctx.measureText(latestText).width;
        const bestMonthWidth = ctx.measureText(bestMonthText).width;

        const circleIconWidth = iconRadius * 2;
        const monthIconWidth = 20;

        const firstItemWidth = circleIconWidth + iconTextGap + firstWidth;
        const latestItemWidth = circleIconWidth + iconTextGap + latestWidth;
        const bestMonthItemWidth = monthIconWidth + iconTextGap + bestMonthWidth;

        const totalWidth = firstItemWidth + gap + latestItemWidth + gap + bestMonthItemWidth;

        let x = Math.max(18, (width - totalWidth) / 2);

        // First achievement
        // this.drawLegendCircle(ctx, x + iconRadius, y, iconRadius, graphColors.secondary);

        x += circleIconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(firstText, x, y);

        x += firstWidth + gap;

        // Latest achievement
        // this.drawLegendCircle(ctx, x + iconRadius, y, iconRadius, graphColors.positive);

        x += circleIconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(latestText, x, y);

        x += latestWidth + gap;

        // Best month
        // this.drawBestMonthLegendIcon(ctx, x, y, monthIconWidth);

        x += monthIconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(bestMonthText, x, y);

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

    private drawBestMonthLegendIcon(ctx: CanvasRenderingContext2D, x: number, y: number, width: number): void {
        ctx.save();

        const height = 12;
        const top = y - height / 2;

        ctx.fillStyle = graphColors.accent;
        ctx.globalAlpha = 0.18;
        ctx.fillRect(x, top, width, height);

        ctx.globalAlpha = 1;

        ctx.strokeStyle = graphColors.accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, top, width, height);

        ctx.restore();
    }

    //#endregion
}
