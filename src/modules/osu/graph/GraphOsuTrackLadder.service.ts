import { AbstractService } from "@/core/framework/AbstractService";
import { Import, Trace } from "@/core/decorators";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { Chart, ChartConfiguration, Plugin } from "chart.js";
import { GraphRendererService } from "./GraphRenderer.service";
import { EGraphSize } from "@domain/osu/enums/Graph.enum";
import { graphColors } from "@domain/osu/configs/Graph.config";
import { TOsuTrackLadderPoint, OsuTrackLadderSimulationConfigDto } from "@domain/osutrack/OsuTrack.dto";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { EOsuTrackLadderMetric } from "@domain/osutrack/enums/OsuTrackLadder.enum";
import { OsuTrackLadderUtils } from "@domain/osutrack/utils/OsuTrackLadderUtils";

interface IGraphPoint {
    x: number;
    y: number;
}

export interface IOsuTrackLadderGraphMarker {
    username: string;
    rank: number;
}

interface IResolvedMarker extends IOsuTrackLadderGraphMarker {
    value: number;
}

interface ILadderMetricDefinition {
    title: string;
    filename: string;

    label: string;

    borderColor: string;
    backgroundColor: string;

    fill: boolean;

    formatValue(value: number): string;
    formatTick(value: number): string;
}

export interface IGraphOsuTrackLadderResult {
    image: Buffer;
    filename: string;
    title: string;
}

export class GraphOsuTrackLadderService extends AbstractService {
    @Import() declare private readonly graphRendererService: GraphRendererService;

    private readonly maxGraphPoints = 2_500;

    @Trace()
    public async generate(
        config: OsuTrackLadderSimulationConfigDto,
        metric: EOsuTrackLadderMetric,
        marker?: IOsuTrackLadderGraphMarker,
    ): Promise<IGraphOsuTrackLadderResult> {
        const definition = this.getDefinition(metric);
        const rawPoints = this.getMetricPoints(config, metric);

        if (rawPoints.length < 2) {
            throw new Exception(EApplicationError.NOT_FOUND, "There is not enough osu!track data to graph.");
        }

        const points = this.samplePoints(rawPoints);
        const resolvedMarker = this.resolveMarker(rawPoints, marker);
        const logY = this.shouldUseLogarithmicY(metric, points);
        const yScaleType: "linear" | "logarithmic" = logY ? "logarithmic" : "linear";

        const configuration: ChartConfiguration<"line", Array<IGraphPoint>> = {
            type: "line",
            plugins: [this.createPlugin(definition, resolvedMarker)],
            data: {
                datasets: [
                    {
                        label: definition.label,
                        data: points,
                        borderColor: definition.borderColor,
                        backgroundColor: definition.backgroundColor,
                        borderWidth: 2.25,
                        fill: definition.fill ? "start" : false,
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
                        type: yScaleType,
                        grace: "5%",
                        ticks: {
                            color: graphColors.tickText,
                            padding: 10,
                            font: {
                                size: 13,
                                weight: "bold",
                            },
                            callback: (value) => definition.formatTick(Number(value)),
                        },
                        grid: {
                            color: graphColors.grid,
                        },
                        border: {
                            display: false,
                        },
                    },
                    x: {
                        type: "logarithmic",
                        min: rawPoints[0]![0],
                        max: rawPoints[rawPoints.length - 1]![0],
                        ticks: {
                            color: graphColors.axisText,
                            font: {
                                size: 12,
                                weight: "bold",
                            },
                            maxTicksLimit: 10,
                            callback: (value) => {
                                const rank = Math.round(Number(value));

                                return `#${DiscordFormatter.number(rank)}`;
                            },
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

        return {
            image: await this.graphRendererService.render(EGraphSize.Standard, configuration),
            filename: definition.filename,
            title: definition.title,
        };
    }

    //#region Data

    private getMetricPoints(
        config: OsuTrackLadderSimulationConfigDto,
        metric: EOsuTrackLadderMetric,
    ): ReadonlyArray<TOsuTrackLadderPoint> {
        switch (metric) {
            case EOsuTrackLadderMetric.Pp:
                return config.rankToPp;
            case EOsuTrackLadderMetric.Density:
                return config.rankToDensity;
            case EOsuTrackLadderMetric.Decay:
                return config.rankToDecay;
        }
    }

    private samplePoints(source: ReadonlyArray<TOsuTrackLadderPoint>): Array<IGraphPoint> {
        if (source.length <= this.maxGraphPoints) {
            return source.map(([x, y]) => ({
                x,
                y,
            }));
        }

        const firstRank = source[0]![0];
        const lastRank = source[source.length - 1]![0];

        const logStart = Math.log(firstRank);
        const logEnd = Math.log(lastRank);

        const points: Array<IGraphPoint> = [];

        for (let i = 0; i < this.maxGraphPoints; i++) {
            const progress = i / (this.maxGraphPoints - 1);
            const rank = Math.exp(logStart + (logEnd - logStart) * progress);

            points.push({
                x: rank,
                y: OsuTrackLadderUtils.interpolate(rank, source),
            });
        }

        return points;
    }

    private resolveMarker(
        points: ReadonlyArray<TOsuTrackLadderPoint>,
        marker?: IOsuTrackLadderGraphMarker,
    ): IResolvedMarker | undefined {
        if (!marker || !Number.isFinite(marker.rank) || marker.rank < 1) {
            return undefined;
        }

        const firstRank = points[0]![0];
        const lastRank = points[points.length - 1]![0];

        if (marker.rank < firstRank || marker.rank > lastRank) {
            return undefined;
        }

        const value = OsuTrackLadderUtils.interpolate(marker.rank, points);

        if (!Number.isFinite(value)) {
            return undefined;
        }

        return {
            ...marker,
            value,
        };
    }

    private shouldUseLogarithmicY(metric: EOsuTrackLadderMetric, points: ReadonlyArray<IGraphPoint>): boolean {
        if (metric === EOsuTrackLadderMetric.Pp) {
            return false;
        }

        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;

        for (const point of points) {
            if (point.y <= 0) {
                return false;
            }

            min = Math.min(min, point.y);
            max = Math.max(max, point.y);
        }

        if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0) {
            return false;
        }
        return max / min >= 100;
    }

    //#endregion

    //#region Definitions

    private getDefinition(metric: EOsuTrackLadderMetric): ILadderMetricDefinition {
        switch (metric) {
            case EOsuTrackLadderMetric.Pp:
                return {
                    title: "osu!track PP distribution",
                    filename: "osutrack-ladder-pp",
                    label: "Performance points by global rank",
                    borderColor: graphColors.ladder.pp.border,
                    backgroundColor: graphColors.ladder.pp.bg,
                    fill: true,
                    formatValue: (value) => `${DiscordFormatter.number(Math.round(value))}pp`,
                    formatTick: (value) => `${DiscordFormatter.number(Math.round(value))}pp`,
                };

            case EOsuTrackLadderMetric.Density:
                return {
                    title: "osu!track PP density",
                    filename: "osutrack-ladder-density",
                    label: "Ranks gained per +1pp",
                    borderColor: graphColors.ladder.density.border,
                    backgroundColor: graphColors.ladder.density.bg,
                    fill: false,
                    formatValue: (value) => `${this.formatScalar(value)} ranks/pp`,
                    formatTick: (value) => this.formatScalar(value),
                };

            case EOsuTrackLadderMetric.Decay:
                return {
                    title: "osu!track rank decay",
                    filename: "osutrack-ladder-decay",
                    label: "Natural rank loss per day",
                    borderColor: graphColors.ladder.decay.border,
                    backgroundColor: graphColors.ladder.decay.bg,
                    fill: false,
                    formatValue: (value) => `${this.formatScalar(value)} ranks/day`,
                    formatTick: (value) => this.formatScalar(value),
                };
        }
    }

    //#endregion

    //#region Plugin

    private createPlugin(definition: ILadderMetricDefinition, marker?: IResolvedMarker): Plugin<"line"> {
        return {
            id: "osu_graph_osutrack_ladder",
            beforeDraw: (chart) => {
                const { ctx, width, height } = chart;

                ctx.save();
                ctx.fillStyle = graphColors.background;
                ctx.fillRect(0, 0, width, height);

                ctx.restore();
            },
            afterDatasetsDraw: (chart) => {
                if (marker) {
                    this.drawMarker(chart, marker);
                }
            },
            afterDraw: (chart) => {
                this.drawHeader(chart.ctx, chart.width, definition, marker);
            },
        };
    }

    private drawMarker(chart: Chart<"line">, marker: IResolvedMarker): void {
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;

        if (!xScale || !yScale) {
            return;
        }

        const x = xScale.getPixelForValue(marker.rank);
        const y = yScale.getPixelForValue(marker.value);

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return;
        }

        const { ctx, chartArea } = chart;

        ctx.save();
        ctx.globalAlpha = 0.55;

        ctx.beginPath();

        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);

        ctx.strokeStyle = graphColors.ladder.marker;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.stroke();

        ctx.restore();
        ctx.save();

        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fillStyle = graphColors.background;
        ctx.fill();

        ctx.strokeStyle = graphColors.ladder.marker;

        ctx.lineWidth = 3;

        ctx.stroke();
        ctx.restore();
    }

    private drawHeader(
        ctx: CanvasRenderingContext2D,
        width: number,
        definition: ILadderMetricDefinition,
        marker?: IResolvedMarker,
    ): void {
        ctx.save();

        ctx.font = "bold 13px sans-serif";

        ctx.textBaseline = "middle";

        ctx.textAlign = "left";

        const y = 25;

        const lineWidth = 22;
        const lineTextGap = 9;

        const metricText = definition.label;

        const metricTextWidth = ctx.measureText(metricText).width;

        const metricWidth = lineWidth + lineTextGap + metricTextWidth;

        if (!marker) {
            let x = (width - metricWidth) / 2;
            x = Math.max(18, x);

            this.drawLegendLine(ctx, x, y, lineWidth, definition.borderColor);

            x += lineWidth + lineTextGap;
            ctx.fillStyle = graphColors.text;
            ctx.fillText(metricText, x, y);
            ctx.restore();

            return;
        }

        const markerText =
            `${marker.username}` +
            ` · #${DiscordFormatter.number(Math.round(marker.rank))}` +
            ` · ${definition.formatValue(marker.value)}`;

        const markerTextWidth = ctx.measureText(markerText).width;

        const markerRadius = 6;
        const markerIconWidth = markerRadius * 2;

        const markerTextGap = 9;
        const itemGap = 30;

        const markerWidth = markerIconWidth + markerTextGap + markerTextWidth;
        const totalWidth = metricWidth + itemGap + markerWidth;

        let x = Math.max(18, (width - totalWidth) / 2);

        this.drawLegendLine(ctx, x, y, lineWidth, definition.borderColor);

        x += lineWidth + lineTextGap;
        ctx.fillStyle = graphColors.text;
        ctx.fillText(metricText, x, y);

        x += metricTextWidth + itemGap;

        this.drawLegendCircle(ctx, x + markerRadius, y, markerRadius, graphColors.ladder.marker);

        x += markerIconWidth + markerTextGap;
        ctx.fillStyle = graphColors.text;
        ctx.fillText(markerText, x, y);

        ctx.restore();
    }

    private drawLegendLine(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, color: string): void {
        ctx.save();

        ctx.beginPath();

        ctx.moveTo(x, y);
        ctx.lineTo(x + width, y);

        ctx.strokeStyle = color;

        ctx.lineWidth = 3;
        ctx.lineCap = "round";

        ctx.stroke();

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

    //#region Formatting

    private formatScalar(value: number): string {
        const abs = Math.abs(value);

        if (abs >= 1_000) {
            return DiscordFormatter.number(Math.round(value));
        }

        if (abs >= 100) {
            return value.toFixed(0);
        }

        if (abs >= 10) {
            return value.toFixed(1);
        }

        if (abs >= 1) {
            return value.toFixed(2);
        }

        if (abs >= 0.01) {
            return value.toFixed(3);
        }

        if (abs >= 0.0001) {
            return value.toFixed(5);
        }

        return value.toExponential(2);
    }

    //#endregion
}
