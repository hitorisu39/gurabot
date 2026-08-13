import { AbstractService } from "@/core/framework/AbstractService";
import { Import, Trace } from "@/core/decorators";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { Chart, ChartConfiguration, Plugin } from "chart.js";
import { GraphRendererService } from "./GraphRenderer.service";
import { EGraphSize } from "@domain/osu/enums/Graph.enum";
import { graphColors } from "@domain/osu/configs/Graph.config";
import { OsuTrackStatsHistoryDto } from "@domain/osutrack/OsuTrack.dto";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";

interface IGraphPoint {
    x: number;
    y: number;
}

interface IGradePoint {
    timestamp: number;
    date: Date;

    ss: number;
    s: number;
    a: number;
}

interface IGradeStats {
    first: IGradePoint;
    latest: IGradePoint;

    gainedSS: number;
    gainedS: number;
    gainedA: number;
}

export class GraphOsuTrackGradesService extends AbstractService {
    @Import() declare private readonly graphRendererService: GraphRendererService;

    @Trace()
    public async generate(history: ReadonlyArray<OsuTrackStatsHistoryDto>): Promise<Buffer> {
        const points = this.normalizeHistory(history);
        const stats = this.calculateStats(points);

        const ssData: Array<IGraphPoint> = points.map((point) => ({
            x: point.timestamp,
            y: point.ss,
        }));

        const sData: Array<IGraphPoint> = points.map((point) => ({
            x: point.timestamp,
            y: point.s,
        }));

        const aData: Array<IGraphPoint> = points.map((point) => ({
            x: point.timestamp,
            y: point.a,
        }));

        const configuration: ChartConfiguration<"line", Array<IGraphPoint>> = {
            type: "line",
            plugins: [this.createPlugin(stats)],
            data: {
                datasets: [
                    {
                        label: "SS ranks",
                        data: ssData,
                        borderColor: graphColors.osutrack.grades.ss,
                        borderWidth: 2,
                        fill: false,
                        tension: 0.18,
                        parsing: false,
                        normalized: true,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        pointHitRadius: 0,
                        spanGaps: false,
                    },
                    {
                        label: "S ranks",
                        data: sData,
                        borderColor: graphColors.osutrack.grades.s,
                        borderWidth: 2,
                        fill: false,
                        tension: 0.18,
                        parsing: false,
                        normalized: true,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        pointHitRadius: 0,
                        spanGaps: false,
                    },
                    {
                        label: "A ranks",
                        data: aData,
                        borderColor: graphColors.osutrack.grades.a,
                        borderWidth: 2,
                        fill: false,
                        tension: 0.18,
                        parsing: false,
                        normalized: true,
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

                            callback: (value) => DiscordFormatter.number(Math.round(Number(value))),
                        },
                        grid: {
                            color: graphColors.grid,
                        },
                        border: {
                            display: false,
                        },
                    },
                    x: {
                        type: "linear",
                        min: points.at(0)?.timestamp,
                        max: points.at(-1)?.timestamp,
                        ticks: {
                            color: graphColors.axisText,
                            font: {
                                size: 12,
                                weight: "bold",
                            },
                            maxTicksLimit: 10,
                            maxRotation: 0,
                            callback: (value) => DateFormatter.monthYear(new Date(Number(value))),
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

    private normalizeHistory(history: ReadonlyArray<OsuTrackStatsHistoryDto>): Array<IGradePoint> {
        const points: Array<IGradePoint> = [];

        for (const entry of history) {
            const date = new Date(entry.timestamp);

            const ss = Number(entry.countRankSS);
            const s = Number(entry.countRankS);
            const a = Number(entry.countRankA);

            if (
                Number.isNaN(date.getTime()) ||
                !Number.isFinite(ss) ||
                !Number.isFinite(s) ||
                !Number.isFinite(a) ||
                ss < 0 ||
                s < 0 ||
                a < 0
            ) {
                continue;
            }

            points.push({
                timestamp: date.getTime(),
                date,

                ss,
                s,
                a,
            });
        }

        points.sort((left, right) => left.timestamp - right.timestamp);

        if (!points.length) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                "osu!track returned no valid grade history for this user.",
            );
        }

        return points;
    }

    private calculateStats(points: ReadonlyArray<IGradePoint>): IGradeStats {
        const first = points.at(0);
        const latest = points.at(-1);

        if (!first || !latest) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "Cannot calculate osu!track grade statistics from an empty dataset.",
            );
        }

        return {
            first,
            latest,
            gainedSS: latest.ss - first.ss,
            gainedS: latest.s - first.s,
            gainedA: latest.a - first.a,
        };
    }

    //#endregion

    //#region Plugin

    private createPlugin(stats: IGradeStats): Plugin<"line"> {
        return {
            id: "osu_graph_osutrack_grades",

            beforeDraw: (chart) => {
                const { ctx, width, height } = chart;
                ctx.save();
                ctx.fillStyle = graphColors.background;
                ctx.fillRect(0, 0, width, height);
                ctx.restore();
            },

            afterDatasetsDraw: (chart) => {
                this.drawPointMarker(chart, stats.latest.timestamp, stats.latest.ss, graphColors.osutrack.grades.ss, 7);
                this.drawPointMarker(chart, stats.latest.timestamp, stats.latest.s, graphColors.osutrack.grades.s, 7);
                this.drawPointMarker(chart, stats.latest.timestamp, stats.latest.a, graphColors.osutrack.grades.a, 7);
            },

            afterDraw: (chart) => {
                this.drawHeader(chart, stats);
            },
        };
    }

    private drawPointMarker(
        chart: Chart<"line">,
        timestamp: number,
        value: number,
        color: string,
        radius: number,
    ): void {
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;

        if (!xScale || !yScale) {
            return;
        }

        const x = xScale.getPixelForValue(timestamp);
        const y = yScale.getPixelForValue(value);

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

    private drawHeader(chart: Chart<"line">, stats: IGradeStats): void {
        const { ctx, width } = chart;

        ctx.save();

        ctx.font = "bold 13px sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        const y = 25;
        const gap = 30;
        const iconRadius = 6;
        const iconTextGap = 10;

        const ssText =
            `SS: ${DiscordFormatter.number(stats.latest.ss)}` + ` · ${DiscordFormatter.delta(stats.gainedSS)}`;
        const sText = `S: ${DiscordFormatter.number(stats.latest.s)}` + ` · ${DiscordFormatter.delta(stats.gainedS)}`;
        const aText = `A: ${DiscordFormatter.number(stats.latest.a)}` + ` · ${DiscordFormatter.delta(stats.gainedA)}`;

        const ssWidth = ctx.measureText(ssText).width;
        const sWidth = ctx.measureText(sText).width;
        const aWidth = ctx.measureText(aText).width;

        const iconWidth = iconRadius * 2;

        const totalWidth =
            iconWidth +
            iconTextGap +
            ssWidth +
            gap +
            iconWidth +
            iconTextGap +
            sWidth +
            gap +
            iconWidth +
            iconTextGap +
            aWidth;

        let x = Math.max(18, (width - totalWidth) / 2);

        // SS
        this.drawLegendCircle(ctx, x + iconRadius, y, iconRadius, graphColors.osutrack.grades.ss);

        x += iconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(ssText, x, y);

        x += ssWidth + gap;

        // S
        this.drawLegendCircle(ctx, x + iconRadius, y, iconRadius, graphColors.osutrack.grades.s);

        x += iconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(sText, x, y);

        x += sWidth + gap;

        // A
        this.drawLegendCircle(ctx, x + iconRadius, y, iconRadius, graphColors.osutrack.grades.a);

        x += iconWidth + iconTextGap;

        ctx.fillStyle = graphColors.text;
        ctx.fillText(aText, x, y);

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
