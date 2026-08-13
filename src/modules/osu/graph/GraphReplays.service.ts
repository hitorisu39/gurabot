import { AbstractService } from "@/core/framework/AbstractService";
import { Import, Trace } from "@/core/decorators";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ChartConfiguration, Chart, Plugin } from "chart.js";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { graphColors } from "@domain/osu/configs/Graph.config";
import { GraphRendererService } from "./GraphRenderer.service";
import { EGraphSize } from "@domain/osu/enums/Graph.enum";

interface IReplayCount {
    startDate: string;
    count: number;
}

interface IReplayPoint {
    date: Date;
    count: number;
}

interface IIndexedReplayPoint {
    index: number;
    point: IReplayPoint;
}

interface IReplayBreak {
    startIndex: number;
    endIndex: number;
    length: number;
}

interface IReplayStats {
    highest: IIndexedReplayPoint;
    lowestNonZero: IIndexedReplayPoint | null;
    longestBreak: IReplayBreak | null;
}

export class GraphReplaysService extends AbstractService {
    @Import() declare private readonly graphRendererService: GraphRendererService;

    @Trace()
    public async generate(rawCounts: ReadonlyArray<IReplayCount>): Promise<Buffer> {
        const points = this.normalizeCounts(rawCounts);

        if (!points.length) {
            throw new Exception(EApplicationError.NOT_FOUND, "This user has no replays watched history.");
        }

        const stats = this.calculateStats(points);
        const configuration: ChartConfiguration<"line", Array<number | null>, string> = {
            type: "line",
            plugins: [this.createPlugin(points, stats)],

            data: {
                labels: points.map((point) => DateFormatter.monthYear(point.date)),
                datasets: [
                    {
                        label: "Replays watched",
                        data: points.map((point) => point.count),

                        backgroundColor: graphColors.replays.bg,
                        borderColor: graphColors.replays.border,

                        borderWidth: 2,
                        fill: true,
                        tension: 0.32,

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

    private normalizeCounts(rawCounts: ReadonlyArray<IReplayCount>): Array<IReplayPoint> {
        const countsByMonth = new Map<number, number>();

        for (const entry of rawCounts) {
            const parsed = new Date(entry.startDate);
            const count = Number(entry.count);

            if (Number.isNaN(parsed.getTime()) || !Number.isFinite(count)) {
                continue;
            }

            const date = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
            const timestamp = date.getTime();

            const normalizedCount = Math.max(0, Math.floor(count));
            const existingCount = countsByMonth.get(timestamp);

            countsByMonth.set(
                timestamp,
                existingCount === undefined ? normalizedCount : Math.max(existingCount, normalizedCount),
            );
        }

        const months = Array.from(countsByMonth.keys()).sort((a, b) => a - b);

        const firstTimestamp = months.at(0);
        const lastTimestamp = months.at(-1);

        if (firstTimestamp === undefined || lastTimestamp === undefined) {
            return [];
        }

        const firstMonth = new Date(firstTimestamp);
        const lastMonth = new Date(lastTimestamp);

        const result: Array<IReplayPoint> = [];

        for (let current = firstMonth; current.getTime() <= lastMonth.getTime(); current = this.addMonths(current, 1)) {
            result.push({
                date: current,
                count: countsByMonth.get(current.getTime()) ?? 0,
            });
        }

        return result;
    }

    private addMonths(date: Date, amount: number): Date {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
    }

    //#endregion

    //#region Statistics

    private calculateStats(points: ReadonlyArray<IReplayPoint>): IReplayStats {
        const firstPoint = points.at(0);

        if (!firstPoint) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "Cannot calculate replay statistics from an empty dataset.",
            );
        }

        let highest: IIndexedReplayPoint = {
            index: 0,
            point: firstPoint,
        };

        let lowestNonZero: IIndexedReplayPoint | null =
            firstPoint.count > 0
                ? {
                      index: 0,
                      point: firstPoint,
                  }
                : null;

        for (const [index, point] of points.entries()) {
            if (point.count > highest.point.count) {
                highest = {
                    index,
                    point,
                };
            }

            if (point.count > 0 && (lowestNonZero === null || point.count < lowestNonZero.point.count)) {
                lowestNonZero = {
                    index,
                    point,
                };
            }
        }

        return {
            highest,
            lowestNonZero,
            longestBreak: this.findLongestBreak(points),
        };
    }

    private findLongestBreak(points: ReadonlyArray<IReplayPoint>): IReplayBreak | null {
        let currentStart: number | null = null;
        let longest: IReplayBreak | null = null;

        for (const [index, point] of points.entries()) {
            if (point.count === 0) {
                currentStart ??= index;
                continue;
            }

            if (currentStart === null) {
                continue;
            }

            const length = index - currentStart;

            if (longest === null || length > longest.length) {
                longest = {
                    startIndex: currentStart,
                    endIndex: index - 1,
                    length,
                };
            }

            currentStart = null;
        }

        if (currentStart !== null) {
            const length = points.length - currentStart;

            if (longest === null || length > longest.length) {
                longest = {
                    startIndex: currentStart,
                    endIndex: points.length - 1,
                    length,
                };
            }
        }

        return longest;
    }

    //#endregion

    //#region Plugin

    private createPlugin(points: ReadonlyArray<IReplayPoint>, stats: IReplayStats): Plugin<"line"> {
        return {
            id: "osu_graph_replays",

            beforeDraw: (chart) => {
                const { ctx, width, height } = chart;

                ctx.save();

                ctx.fillStyle = graphColors.background;
                ctx.fillRect(0, 0, width, height);

                ctx.restore();
            },

            beforeDatasetsDraw: (chart) => {
                if (!stats.longestBreak) {
                    return;
                }

                this.drawBreakRegion(chart, points, stats.longestBreak);
            },

            afterDatasetsDraw: (chart) => {
                this.drawPointMarker(chart, stats.highest, graphColors.positive);

                if (stats.lowestNonZero) {
                    this.drawPointMarker(chart, stats.lowestNonZero, graphColors.negative);
                }
            },

            afterDraw: (chart) => {
                this.drawHeader(chart, stats);
            },
        };
    }

    private drawBreakRegion(
        chart: Chart<"line">,
        points: ReadonlyArray<IReplayPoint>,
        longestBreak: IReplayBreak,
    ): void {
        const xScale = chart.scales.x;

        if (!xScale) {
            return;
        }

        const { ctx, chartArea } = chart;

        const startPixel = xScale.getPixelForValue(longestBreak.startIndex);
        const endPixel = xScale.getPixelForValue(longestBreak.endIndex);

        const previousPixel =
            longestBreak.startIndex > 0 ? xScale.getPixelForValue(longestBreak.startIndex - 1) : chartArea.left;

        const nextPixel =
            longestBreak.endIndex < points.length - 1
                ? xScale.getPixelForValue(longestBreak.endIndex + 1)
                : chartArea.right;

        const left = longestBreak.startIndex === 0 ? chartArea.left : (previousPixel + startPixel) / 2;

        const right = longestBreak.endIndex === points.length - 1 ? chartArea.right : (endPixel + nextPixel) / 2;

        ctx.save();

        ctx.fillStyle = graphColors.break.bg;
        ctx.fillRect(left, chartArea.top, right - left, chartArea.bottom - chartArea.top);

        ctx.strokeStyle = graphColors.break.border;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);

        ctx.beginPath();
        ctx.moveTo(left, chartArea.top);
        ctx.lineTo(left, chartArea.bottom);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(right, chartArea.top);
        ctx.lineTo(right, chartArea.bottom);
        ctx.stroke();

        ctx.setLineDash([]);

        const label = `${longestBreak.length} month${longestBreak.length === 1 ? "" : "s"} break`;

        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        const labelWidth = ctx.measureText(label).width;

        if (right - left >= labelWidth + 16) {
            ctx.fillStyle = graphColors.break.text;
            ctx.fillText(label, (left + right) / 2, chartArea.top + 8);
        }

        ctx.restore();
    }

    private drawPointMarker(chart: Chart<"line">, entry: IIndexedReplayPoint, color: string): void {
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;

        if (!xScale || !yScale) {
            return;
        }

        const { ctx } = chart;

        const x = xScale.getPixelForValue(entry.index);
        const y = yScale.getPixelForValue(entry.point.count);

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

    private drawHeader(chart: Chart<"line">, stats: IReplayStats): void {
        const { ctx, width } = chart;

        ctx.save();

        ctx.font = "bold 13px sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        const y = 25;
        const gap = 30;
        const iconSize = 6;
        const iconTextGap = 10;

        const highestText =
            `Highest: ${DiscordFormatter.number(stats.highest.point.count)}` +
            ` · ${DateFormatter.monthYear(stats.highest.point.date)}`;

        const lowestText = stats.lowestNonZero
            ? `Lowest: ${DiscordFormatter.number(stats.lowestNonZero.point.count)}` +
              ` · ${DateFormatter.monthYear(stats.lowestNonZero.point.date)}`
            : "Lowest: —";

        const breakText = stats.longestBreak
            ? `Longest break: ${stats.longestBreak.length} month${stats.longestBreak.length === 1 ? "" : "s"}`
            : "Longest break: None";

        const highestWidth = ctx.measureText(highestText).width;
        const lowestWidth = ctx.measureText(lowestText).width;
        const breakWidth = ctx.measureText(breakText).width;

        const highestItemWidth = iconSize * 2 + iconTextGap + highestWidth;
        const lowestItemWidth = iconSize * 2 + iconTextGap + lowestWidth;

        const breakIconWidth = 18;
        const breakItemWidth = breakIconWidth + iconTextGap + breakWidth;

        const totalWidth = highestItemWidth + gap + lowestItemWidth + gap + breakItemWidth;

        let x = Math.max(18, (width - totalWidth) / 2);

        // Highest
        this.drawLegendCircle(ctx, x + iconSize, y, iconSize, graphColors.positive);

        x += iconSize * 2 + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(highestText, x, y);

        x += highestWidth + gap;

        // Lowest
        this.drawLegendCircle(ctx, x + iconSize, y, iconSize, graphColors.negative);

        x += iconSize * 2 + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(lowestText, x, y);

        x += lowestWidth + gap;

        // Longest break
        this.drawBreakLegendIcon(ctx, x, y, breakIconWidth, 12);

        x += breakIconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(breakText, x, y);

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

    private drawBreakLegendIcon(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        width: number,
        height: number,
    ): void {
        ctx.save();

        const top = y - height / 2;

        ctx.fillStyle = graphColors.break.bg;
        ctx.fillRect(x, top, width, height);

        ctx.strokeStyle = graphColors.break.legendBorder;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 2]);

        ctx.strokeRect(x, top, width, height);

        ctx.setLineDash([]);

        ctx.restore();
    }

    //#endregion
}
