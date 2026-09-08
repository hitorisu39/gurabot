import { AbstractService } from "@/core/framework/AbstractService";
import { Import, Trace } from "@/core/decorators";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { graphColors } from "@domain/osu/configs/Graph.config";
import { EGraphSize } from "@domain/osu/enums/Graph.enum";
import { OtrProfileFormatter } from "@domain/otr/formatters/OtrProfile.formatter";
import { OtrPlayerRatingAdjustmentDto } from "@domain/otr/OtrPlayer.dto";
import { IOtrRatingHistoryStats, OtrPlayerAttributesCalculator } from "@domain/otr/utils/OtrPlayerAttributesCalculator";
import { GraphRendererService } from "@/modules/osu/graph/GraphRenderer.service";
import { Chart, ChartConfiguration, Plugin } from "chart.js";

interface IOtrRatingHistoryPoint {
    date: Date;
    rating: number;
}

interface IIndexedRatingHistoryPoint {
    index: number;
    point: IOtrRatingHistoryPoint;
}

export class OtrHistoryGraphService extends AbstractService {
    @Import() declare private readonly graphRendererService: GraphRendererService;

    @Trace()
    public async generate(adjustments: ReadonlyArray<OtrPlayerRatingAdjustmentDto>): Promise<Buffer> {
        const points = this.normalize(adjustments);
        if (points.length < 2) {
            throw new Exception(EApplicationError.NOT_FOUND, "This player has no o!TR rating history.");
        }

        const stats = OtrPlayerAttributesCalculator.ratingHistory(adjustments);
        if (!stats) {
            throw new Exception(EApplicationError.NOT_FOUND, "This player has no o!TR rating history.");
        }

        const peak = this.findPeak(points);
        const plugin = this.createHistoryPlugin(stats, peak);

        const configuration: ChartConfiguration<"line", Array<number>, string> = {
            type: "line",
            plugins: [plugin],
            data: {
                labels: points.map((point) => DateFormatter.monthYear(point.date)),
                datasets: [
                    {
                        label: "o!TR Rating",
                        data: points.map((point) => point.rating),

                        backgroundColor: graphColors.history.bg,
                        borderColor: graphColors.history.border,

                        borderWidth: 2,
                        fill: true,
                        tension: 0.32,

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

    //#region Data

    private normalize(adjustments: ReadonlyArray<OtrPlayerRatingAdjustmentDto>): Array<IOtrRatingHistoryPoint> {
        const history = adjustments
            .filter(
                (adjustment) =>
                    Number.isFinite(adjustment.timestamp.getTime()) &&
                    Number.isFinite(adjustment.ratingBefore) &&
                    Number.isFinite(adjustment.ratingAfter),
            )
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        const first = history.at(0);

        if (!first) return [];

        return [
            {
                date: first.timestamp,
                rating: first.ratingBefore,
            },
            ...history.map((adjustment) => ({
                date: adjustment.timestamp,
                rating: adjustment.ratingAfter,
            })),
        ];
    }

    private findPeak(points: ReadonlyArray<IOtrRatingHistoryPoint>): IIndexedRatingHistoryPoint {
        let peak: IIndexedRatingHistoryPoint = {
            index: 0,
            point: points[0]!,
        };

        for (const [index, point] of points.entries()) {
            if (point.rating > peak.point.rating) {
                peak = {
                    index,
                    point,
                };
            }
        }

        return peak;
    }

    //#endregion

    //#region Chart

    private createHistoryPlugin(stats: IOtrRatingHistoryStats, peak: IIndexedRatingHistoryPoint): Plugin<"line"> {
        return {
            id: "otr_profile_rating_history",

            beforeDraw: (chart) => {
                const { ctx, width, height } = chart;

                ctx.save();
                ctx.fillStyle = graphColors.background;
                ctx.fillRect(0, 0, width, height);
                ctx.restore();
            },

            afterDatasetsDraw: (chart) => {
                this.drawPointMarker(chart, peak, graphColors.positive);
            },

            afterDraw: (chart) => {
                this.drawHeader(chart, stats);
            },
        };
    }

    private drawPointMarker(chart: Chart<"line">, entry: IIndexedRatingHistoryPoint, color: string): void {
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;

        if (!xScale || !yScale) return;

        const { ctx } = chart;

        const x = xScale.getPixelForValue(entry.index);
        const y = yScale.getPixelForValue(entry.point.rating);

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

    private drawHeader(chart: Chart<"line">, stats: IOtrRatingHistoryStats): void {
        const { ctx, width } = chart;

        ctx.save();

        ctx.font = "bold 13px sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        const y = 25;
        const gap = 30;
        const iconSize = 6;
        const iconTextGap = 10;

        const currentText = `Current: ${OtrProfileFormatter.rating(stats.current)}`;
        const peakText = `Peak: ${OtrProfileFormatter.rating(stats.peak)}`;
        const changeText = `Change: ${DiscordFormatter.delta(DiscordFormatter.fixed(stats.change))}`;

        const currentWidth = ctx.measureText(currentText).width;
        const peakWidth = ctx.measureText(peakText).width;
        const changeWidth = ctx.measureText(changeText).width;

        const currentItemWidth = iconSize * 2 + iconTextGap + currentWidth;
        const peakItemWidth = iconSize * 2 + iconTextGap + peakWidth;
        const changeItemWidth = iconSize * 2 + iconTextGap + changeWidth;

        const totalWidth = currentItemWidth + gap + peakItemWidth + gap + changeItemWidth;

        let x = Math.max(18, (width - totalWidth) / 2);

        this.drawLegendCircle(ctx, x + iconSize, y, iconSize, graphColors.history.border);
        x += iconSize * 2 + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(currentText, x, y);

        x += currentWidth + gap;

        this.drawLegendCircle(ctx, x + iconSize, y, iconSize, graphColors.positive);
        x += iconSize * 2 + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(peakText, x, y);

        x += peakWidth + gap;

        this.drawLegendCircle(ctx, x + iconSize, y, iconSize, graphColors.secondary);
        x += iconSize * 2 + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(changeText, x, y);

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
