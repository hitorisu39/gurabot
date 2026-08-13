import { AbstractService } from "@/core/framework/AbstractService";
import { Import, Trace } from "@/core/decorators";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { Chart, ChartConfiguration, Plugin } from "chart.js";
import { Score } from "@generated/adapter/types";
import { graphColors } from "@domain/osu/configs/Graph.config";
import { GraphRendererService } from "./GraphRenderer.service";
import { EGraphSize } from "@domain/osu/enums/Graph.enum";

interface ICurvePoint {
    index: number;
    position: number;
    pp: number | null;
}

interface IValidCurvePoint {
    index: number;
    position: number;
    pp: number;
}

interface ICurveStats {
    top: IValidCurvePoint;
    middle: IValidCurvePoint;
    tail: IValidCurvePoint;
}

export class GraphTopCurveService extends AbstractService {
    @Import() declare private readonly graphRendererService: GraphRendererService;

    @Trace()
    public async generate(scores: ReadonlyArray<Score>): Promise<Buffer> {
        const points = this.normalizeScores(scores);
        const stats = this.calculateStats(points);

        const configuration: ChartConfiguration<"line", Array<number | null>, string> = {
            type: "line",
            plugins: [this.createPlugin(stats)],
            data: {
                labels: points.map((point) => `#${point.position}`),

                datasets: [
                    {
                        label: "Performance points",
                        data: points.map((point) => point.pp),
                        backgroundColor: graphColors.top.curve.bg,
                        borderColor: graphColors.top.curve.border,
                        borderWidth: 2,
                        fill: "start",
                        tension: 0.28,
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

                            callback: (value) => `${Math.round(Number(value))}pp`,
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
                            maxTicksLimit: 11,
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

    private normalizeScores(scores: ReadonlyArray<Score>): Array<ICurvePoint> {
        if (!scores.length) {
            throw new Exception(EApplicationError.NOT_FOUND, "This user has no top plays.");
        }

        return scores.map((score, index): ICurvePoint => {
            const pp = Number(score.pp);

            return {
                index,
                position: index + 1,
                pp: Number.isFinite(pp) && pp > 0 ? pp : null,
            };
        });
    }

    private calculateStats(points: ReadonlyArray<ICurvePoint>): ICurveStats {
        const valid = points.filter((point): point is IValidCurvePoint => point.pp !== null);

        const top = valid.at(0);
        const tail = valid.at(-1);

        if (!top || !tail) {
            throw new Exception(EApplicationError.NOT_FOUND, "This user's top plays have no PP values.");
        }

        const targetPosition = (points.length + 1) / 2;

        let middle = top;
        let middleDistance = Math.abs(top.position - targetPosition);

        for (const point of valid) {
            const distance = Math.abs(point.position - targetPosition);

            if (distance < middleDistance) {
                middle = point;
                middleDistance = distance;
            }
        }

        return {
            top,
            middle,
            tail,
        };
    }

    //#endregion

    //#region Plugin

    private createPlugin(stats: ICurveStats): Plugin<"line"> {
        return {
            id: "osu_graph_top_curve",

            beforeDraw: (chart) => {
                const { ctx, width, height } = chart;

                ctx.save();

                ctx.fillStyle = graphColors.background;
                ctx.fillRect(0, 0, width, height);

                ctx.restore();
            },

            afterDatasetsDraw: (chart) => {
                /*
                 * Draw the middle first so endpoint semantics win
                 * if a very small top list causes overlap.
                 */
                this.drawPointMarker(chart, stats.middle, graphColors.secondary, 7);
                this.drawPointMarker(chart, stats.tail, graphColors.negative, 7);
                this.drawPointMarker(chart, stats.top, graphColors.positive, 8);
            },

            afterDraw: (chart) => {
                this.drawHeader(chart, stats);
            },
        };
    }

    private drawPointMarker(chart: Chart<"line">, point: IValidCurvePoint, color: string, radius: number): void {
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;

        if (!xScale || !yScale) {
            return;
        }

        const x = xScale.getPixelForValue(point.index);

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

    private drawHeader(chart: Chart<"line">, stats: ICurveStats): void {
        const { ctx, width } = chart;

        ctx.save();

        ctx.font = "bold 13px sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        const y = 25;
        const gap = 30;
        const iconRadius = 6;
        const iconTextGap = 10;

        const topText = `#${stats.top.position}: ` + this.formatPp(stats.top.pp);
        const middleText = `#${stats.middle.position}: ` + this.formatPp(stats.middle.pp);
        const tailText = `#${stats.tail.position}: ` + this.formatPp(stats.tail.pp);
        
        const topWidth = ctx.measureText(topText).width;
        const middleWidth = ctx.measureText(middleText).width;
        const tailWidth = ctx.measureText(tailText).width;

        const iconWidth = iconRadius * 2;

        const totalWidth =
            iconWidth +
            iconTextGap +
            topWidth +
            gap +
            iconWidth +
            iconTextGap +
            middleWidth +
            gap +
            iconWidth +
            iconTextGap +
            tailWidth;

        let x = Math.max(18, (width - totalWidth) / 2);

        this.drawLegendCircle(ctx, x + iconRadius, y, iconRadius, graphColors.positive);

        x += iconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(topText, x, y);

        x += topWidth + gap;

        this.drawLegendCircle(ctx, x + iconRadius, y, iconRadius, graphColors.secondary);

        x += iconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(middleText, x, y);

        x += middleWidth + gap;

        this.drawLegendCircle(ctx, x + iconRadius, y, iconRadius, graphColors.negative);

        x += iconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(tailText, x, y);

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

    private formatPp(value: number): string {
        return `${value.toFixed(1)}pp`;
    }

    //#endregion
}
