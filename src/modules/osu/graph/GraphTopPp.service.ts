import { AbstractService } from "@/core/framework/AbstractService";
import { Import, Trace } from "@/core/decorators";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ChartConfiguration, Plugin } from "chart.js";
import { Score } from "@generated/adapter/types";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { graphColors } from "@domain/osu/configs/Graph.config";
import { GraphRendererService } from "./GraphRenderer.service";
import { EGraphSize } from "@domain/osu/enums/Graph.enum";

interface IPpBin {
    index: number;
    min: number;
    max: number;
    count: number;
}

interface IPpStats {
    lowest: number;
    highest: number;
    median: number;
    densest: IPpBin;
}

export class GraphTopPpService extends AbstractService {
    @Import() declare private readonly graphRendererService: GraphRendererService;

    @Trace()
    public async generate(scores: ReadonlyArray<Score>): Promise<Buffer> {
        const values = this.getPpValues(scores);

        if (!values.length) {
            throw new Exception(EApplicationError.NOT_FOUND, "This user's top plays have no PP values.");
        }

        const bins = this.createBins(values);
        const stats = this.calculateStats(values, bins);

        const backgroundColors = bins.map((bin) =>
            bin.index === stats.densest.index ? graphColors.accent : graphColors.top.pp.bg,
        );

        const borderColors = bins.map((bin) =>
            bin.index === stats.densest.index ? graphColors.accent : graphColors.top.pp.border,
        );

        const configuration: ChartConfiguration<"bar", Array<number>, string> = {
            type: "bar",
            plugins: [this.createPlugin(stats)],

            data: {
                labels: bins.map((bin) => this.formatBinLabel(bin)),

                datasets: [
                    {
                        label: "Top plays",
                        data: bins.map((bin) => bin.count),

                        backgroundColor: backgroundColors,
                        borderColor: borderColors,
                        borderWidth: 2,

                        borderRadius: 4,
                        barPercentage: 0.86,
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
                        ticks: {
                            color: graphColors.axisText,

                            font: {
                                size: 11,
                                weight: "bold",
                            },

                            autoSkip: false,
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

    private getPpValues(scores: ReadonlyArray<Score>): Array<number> {
        return scores.map((score) => Number(score.pp)).filter((pp) => Number.isFinite(pp) && pp > 0);
    }

    private createBins(values: ReadonlyArray<number>): Array<IPpBin> {
        const lowest = Math.min(...values);
        const highest = Math.max(...values);

        if (lowest === highest) {
            return [
                {
                    index: 0,
                    min: lowest,
                    max: highest,
                    count: values.length,
                },
            ];
        }

        const desiredBinCount = 10;
        const step = this.niceStep((highest - lowest) / desiredBinCount);

        const start = Math.floor(lowest / step) * step;

        let end = Math.ceil(highest / step) * step;

        if (end <= highest) {
            end += step;
        }

        const binCount = Math.max(1, Math.ceil((end - start) / step));

        const bins = Array.from(
            { length: binCount },
            (_, index): IPpBin => ({
                index,
                min: start + step * index,
                max: start + step * (index + 1),
                count: 0,
            }),
        );

        for (const pp of values) {
            const rawIndex = Math.floor((pp - start) / step);

            const index = Math.min(bins.length - 1, Math.max(0, rawIndex));

            const bin = bins.at(index);

            if (bin) {
                bin.count++;
            }
        }

        return bins;
    }

    private niceStep(value: number): number {
        if (!Number.isFinite(value) || value <= 0) {
            return 1;
        }

        const magnitude = Math.pow(10, Math.floor(Math.log10(value)));

        const normalized = value / magnitude;

        let niceNormalized: number;

        if (normalized <= 1) {
            niceNormalized = 1;
        } else if (normalized <= 2) {
            niceNormalized = 2;
        } else if (normalized <= 5) {
            niceNormalized = 5;
        } else {
            niceNormalized = 10;
        }

        return niceNormalized * magnitude;
    }

    //#endregion

    //#region Statistics

    private calculateStats(values: ReadonlyArray<number>, bins: ReadonlyArray<IPpBin>): IPpStats {
        const sorted = [...values].sort((a, b) => a - b);

        const lowest = sorted.at(0);
        const highest = sorted.at(-1);
        const firstBin = bins.at(0);

        if (lowest === undefined || highest === undefined || !firstBin) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "Cannot calculate PP statistics from an empty dataset.",
            );
        }

        let densest = firstBin;

        for (const bin of bins) {
            /*
             * Strict comparison means ties use the lower PP range.
             */
            if (bin.count > densest.count) {
                densest = bin;
            }
        }

        return {
            lowest,
            highest,
            median: this.median(sorted),
            densest,
        };
    }

    private median(sorted: ReadonlyArray<number>): number {
        const middle = Math.floor(sorted.length / 2);

        const upper = sorted.at(middle);

        if (upper === undefined) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "Cannot calculate median from an empty dataset.");
        }

        if (sorted.length % 2 === 1) {
            return upper;
        }

        const lower = sorted.at(middle - 1);

        if (lower === undefined) {
            return upper;
        }

        return (lower + upper) / 2;
    }

    //#endregion

    //#region Plugin

    private createPlugin(stats: IPpStats): Plugin<"bar"> {
        return {
            id: "osu_graph_top_pp",

            beforeDraw: (chart) => {
                const { ctx, width, height } = chart;

                ctx.save();

                ctx.fillStyle = graphColors.background;
                ctx.fillRect(0, 0, width, height);

                ctx.restore();
            },

            afterDraw: (chart) => {
                const { ctx, width } = chart;

                ctx.save();

                ctx.font = "bold 13px sans-serif";
                ctx.textBaseline = "middle";
                ctx.textAlign = "left";

                const y = 25;
                const gap = 30;
                const iconRadius = 6;
                const iconTextGap = 10;

                const medianText = `Median: ${this.formatPp(stats.median)}`;
                const rangeText = `Range: ${this.formatPp(stats.lowest)}` + `–${this.formatPp(stats.highest)}`;

                const densestText =
                    `Densest: ${this.formatBinLabel(stats.densest)}` +
                    ` · ${DiscordFormatter.number(stats.densest.count)} plays`;

                const medianWidth = ctx.measureText(medianText).width;
                const rangeWidth = ctx.measureText(rangeText).width;
                const densestWidth = ctx.measureText(densestText).width;

                const iconWidth = iconRadius * 2;

                const totalWidth =
                    iconWidth +
                    iconTextGap +
                    medianWidth +
                    gap +
                    iconWidth +
                    iconTextGap +
                    rangeWidth +
                    gap +
                    iconWidth +
                    iconTextGap +
                    densestWidth;

                let x = Math.max(18, (width - totalWidth) / 2);

                this.drawLegendCircle(ctx, x + iconRadius, y, iconRadius, graphColors.secondary);

                x += iconWidth + iconTextGap;

                ctx.fillStyle = graphColors.text;
                ctx.fillText(medianText, x, y);

                x += medianWidth + gap;

                this.drawLegendCircle(ctx, x + iconRadius, y, iconRadius, graphColors.positive);

                x += iconWidth + iconTextGap;

                ctx.fillStyle = graphColors.text;
                ctx.fillText(rangeText, x, y);

                x += rangeWidth + gap;

                this.drawLegendCircle(ctx, x + iconRadius, y, iconRadius, graphColors.accent);

                x += iconWidth + iconTextGap;

                ctx.fillStyle = graphColors.text;
                ctx.fillText(densestText, x, y);

                ctx.restore();
            },
        };
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

    //#region Formatting

    private formatPp(value: number): string {
        return `${value.toFixed(1)}pp`;
    }

    private formatBinLabel(bin: IPpBin): string {
        if (bin.min === bin.max) {
            return this.formatPp(bin.min);
        }

        return `${this.formatBoundary(bin.min)}` + `–${this.formatBoundary(bin.max)}`;
    }

    private formatBoundary(value: number): string {
        return Number.isInteger(value) ? value.toString() : value.toFixed(1);
    }

    //#endregion
}
