import { AbstractService } from "@/core/framework/AbstractService";
import { Trace } from "@/core/decorators";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ChartConfiguration, Plugin } from "chart.js";
import { Score } from "@generated/adapter/types";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { graphColors } from "@domain/osu/configs/Graph.config";
import { GraphRendererService } from "./GraphRenderer.service";
import { EGraphSize } from "@domain/osu/enums/Graph.enum";
import { Import } from "@/core/decorators";

interface IHourBucket {
    hour: number;
    count: number;
}

interface IHourWindow {
    startHour: number;
    endHour: number;
    count: number;
}

interface IHourStats {
    peak: IHourBucket;
    peakWindow: IHourWindow;
    activeHours: number;
}

export class GraphTopHoursService extends AbstractService {
    @Import() declare private readonly graphRendererService: GraphRendererService;

    @Trace()
    public async generate(scores: ReadonlyArray<Score>, timezone: string): Promise<Buffer> {
        const offsetMinutes = this.parseTimezoneOffset(timezone);
        const buckets = this.buildBuckets(scores, offsetMinutes);
        const stats = this.calculateStats(buckets);

        const backgroundColors = buckets.map((bucket) =>
            bucket.hour === stats.peak.hour ? graphColors.positive : graphColors.top.hours.bg,
        );

        const borderColors = buckets.map((bucket) =>
            bucket.hour === stats.peak.hour ? graphColors.positive : graphColors.top.hours.border,
        );

        const configuration: ChartConfiguration<"bar", Array<number>, string> = {
            type: "bar",
            plugins: [this.createPlugin(stats)],

            data: {
                labels: buckets.map((bucket) => this.formatHour(bucket.hour)),

                datasets: [
                    {
                        label: "Top plays",
                        data: buckets.map((bucket) => bucket.count),

                        backgroundColor: backgroundColors,
                        borderColor: borderColors,
                        borderWidth: 2,

                        borderRadius: 4,
                        barPercentage: 0.82,
                        categoryPercentage: 0.88,
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

                            maxRotation: 0,
                            autoSkip: false,
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

    private buildBuckets(scores: ReadonlyArray<Score>, offsetMinutes: number): Array<IHourBucket> {
        const buckets = Array.from(
            { length: 24 },
            (_, hour): IHourBucket => ({
                hour,
                count: 0,
            }),
        );

        let validCount = 0;

        for (const score of scores) {
            const date = new Date(score.endedAt);

            if (Number.isNaN(date.getTime())) {
                continue;
            }

            const shifted = new Date(date.getTime() + offsetMinutes * 60_000);

            const hour = shifted.getUTCHours();
            const bucket = buckets.at(hour);

            if (!bucket) {
                continue;
            }

            bucket.count++;
            validCount++;
        }

        if (!validCount) {
            throw new Exception(EApplicationError.NOT_FOUND, "This user has no valid top play timestamps.");
        }

        return buckets;
    }

    private calculateStats(buckets: ReadonlyArray<IHourBucket>): IHourStats {
        const firstBucket = buckets.at(0);

        if (!firstBucket) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "Cannot calculate hour statistics from an empty dataset.",
            );
        }

        let peak = firstBucket;

        for (const bucket of buckets) {
            /*
             * Strict comparison means ties use the earliest hour.
             */
            if (bucket.count > peak.count) {
                peak = bucket;
            }
        }

        let peakWindow: IHourWindow = {
            startHour: 0,
            endHour: 2,
            count: 0,
        };

        for (let startHour = 0; startHour < 24; startHour++) {
            let count = 0;

            for (let offset = 0; offset < 3; offset++) {
                count += buckets.at((startHour + offset) % 24)?.count ?? 0;
            }

            if (count > peakWindow.count) {
                peakWindow = {
                    startHour,
                    endHour: (startHour + 2) % 24,
                    count,
                };
            }
        }

        return {
            peak,
            peakWindow,
            activeHours: buckets.filter((bucket) => bucket.count > 0).length,
        };
    }

    //#endregion

    //#region Plugin

    private createPlugin(stats: IHourStats): Plugin<"bar"> {
        return {
            id: "osu_graph_top_hours",

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
                const iconWidth = 16;
                const iconTextGap = 10;

                const peakText =
                    `Peak: ${this.formatHour(stats.peak.hour)}` +
                    ` · ${DiscordFormatter.number(stats.peak.count)} plays`;

                const windowText =
                    `Peak 3h: ${this.formatHour(stats.peakWindow.startHour)}` +
                    `–${this.formatWindowEnd(stats.peakWindow.endHour)}` +
                    ` · ${DiscordFormatter.number(stats.peakWindow.count)} plays`;

                const activeText = `Active hours: ${stats.activeHours}/24`;

                const peakWidth = ctx.measureText(peakText).width;
                const windowWidth = ctx.measureText(windowText).width;
                const activeWidth = ctx.measureText(activeText).width;

                const totalWidth =
                    iconWidth +
                    iconTextGap +
                    peakWidth +
                    gap +
                    iconWidth +
                    iconTextGap +
                    windowWidth +
                    gap +
                    iconWidth +
                    iconTextGap +
                    activeWidth;

                let x = Math.max(18, (width - totalWidth) / 2);

                this.drawLegendBar(ctx, x, y, iconWidth, graphColors.positive);

                x += iconWidth + iconTextGap;

                ctx.fillStyle = graphColors.text;
                ctx.fillText(peakText, x, y);

                x += peakWidth + gap;

                this.drawLegendBar(ctx, x, y, iconWidth, graphColors.accent);

                x += iconWidth + iconTextGap;

                ctx.fillStyle = graphColors.text;
                ctx.fillText(windowText, x, y);

                x += windowWidth + gap;

                this.drawLegendBar(ctx, x, y, iconWidth, graphColors.top.hours.border);

                x += iconWidth + iconTextGap;

                ctx.fillStyle = graphColors.text;
                ctx.fillText(activeText, x, y);

                ctx.restore();
            },
        };
    }

    private drawLegendBar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, color: string): void {
        ctx.save();

        ctx.fillStyle = color;
        ctx.fillRect(x, y - 5, width, 10);

        ctx.restore();
    }

    //#endregion

    //#region Timezone

    private parseTimezoneOffset(timezone: string): number {
        const match = timezone
            .trim()
            .toUpperCase()
            .match(/^UTC([+-])(\d{1,2})(?::(\d{2}))?$/);

        if (!match) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `Invalid timezone offset '${timezone}'.`);
        }

        const sign = match.at(1) === "-" ? -1 : 1;
        const hours = Number(match.at(2));
        const minutes = Number(match.at(3) ?? "0");

        if (
            !Number.isInteger(hours) ||
            !Number.isInteger(minutes) ||
            hours > 14 ||
            minutes > 59 ||
            (hours === 14 && minutes !== 0)
        ) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `Invalid timezone offset '${timezone}'.`);
        }

        return sign * (hours * 60 + minutes);
    }

    private formatHour(hour: number): string {
        return `${hour.toString().padStart(2, "0")}:00`;
    }

    private formatWindowEnd(hour: number): string {
        return `${hour.toString().padStart(2, "0")}:59`;
    }

    //#endregion
}
