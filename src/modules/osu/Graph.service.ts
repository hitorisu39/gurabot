import { AbstractService } from "@/core/framework/AbstractService";
import { HttpClient } from "@/http";
import { ISkillStrain } from "@domain/core/Calculator";
import { GameMode } from "@generated/adapter/types";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { ChartConfiguration, Plugin } from "chart.js";
import { loadImage, Image } from "canvas";
import { graphFallbackColor, graphStrainColors, graphStrainTargetCount } from "@domain/osu/configs/Graph.config";
import { Trace } from "@/core/decorators";

export class GraphService extends AbstractService {
    declare private chartCanvas: ChartJSNodeCanvas;
    declare private http: HttpClient;

    public async init(): Promise<void> {
        this.http = new HttpClient(this.logger, { name: "OsuGraph" });
        this.chartCanvas = new ChartJSNodeCanvas({
            width: 900,
            height: 265,
            backgroundColour: "transparent",
        });
    }

    @Trace("osu_graph_strains")
    public async strains<M extends GameMode>(
        rawStrains: Array<ISkillStrain<M>>,
        mode: M,
        coverUrl: string,
    ): Promise<Buffer> {
        let coverImage: Image | null = null;

        try {
            const imgBuffer = await this.http.get<Buffer>(coverUrl, { responseType: "arraybuffer" });
            if (imgBuffer) coverImage = await loadImage(imgBuffer);
        } catch {
            this.logger.warn(`Failed to load cover image for graph: ${coverUrl}`);
        }

        const bgPlugin: Plugin = {
            id: "custom_canvas_background_color",
            beforeDraw: (chart) => {
                if (coverImage) {
                    const { ctx, width, height } = chart;
                    ctx.save();
                    // @ts-ignore
                    ctx.drawImage(coverImage, 0, 0, width, height);
                    ctx.fillStyle = "rgba(0, 0, 0, 0.74)";
                    ctx.fillRect(0, 0, width, height);
                    ctx.restore();
                }
            },
        };

        const strains = rawStrains.map((s) => ({ skillName: s.skillName, peaks: [...s.peaks] }));

        if (mode === GameMode.Standard) {
            const aim = strains.find((s) => s.skillName === "Aim");
            const aimNoSlidersIdx = strains.findIndex((s) => s.skillName === "AimNoSliders");

            if (aim && aimNoSlidersIdx !== -1) {
                const aimNoSliders = strains[aimNoSlidersIdx]!;
                const sliderPeaks = aim.peaks.map((val, i) => Math.max(0, val - (aimNoSliders.peaks[i] || 0)));

                strains[aimNoSlidersIdx] = {
                    skillName: "Aim (Sliders)",
                    peaks: sliderPeaks,
                };
            }
        }

        for (const strain of strains) strain.peaks = this.downsample(strain.peaks, graphStrainTargetCount);

        const baseSectionLength = mode === GameMode.Catch ? 750 : 400;
        const originalPeakCount = rawStrains[0]?.peaks.length || 1;
        const downsampledCount = strains[0]?.peaks.length || 1;

        const totalDuration = originalPeakCount * baseSectionLength;
        const stepSize = totalDuration / Math.max(1, downsampledCount - 1);

        const datasets = strains.map((skill) => {
            const color = graphStrainColors[skill.skillName] || graphFallbackColor;
            return {
                label: skill.skillName,
                data: skill.peaks.map((peak, index) => ({
                    x: index * stepSize,
                    y: peak,
                })),
                backgroundColor: color.bg,
                borderColor: color.border,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
            };
        });

        const configuration: ChartConfiguration = {
            type: "line",
            plugins: [bgPlugin],
            data: { datasets },
            options: {
                plugins: {
                    legend: {
                        labels: {
                            color: "rgb(223,223,223)",
                            font: { size: 20, weight: "bold" },
                        },
                    },
                },
                scales: {
                    y: {
                        ticks: { display: false },
                        grid: {
                            color: "rgba(105,105,105, 0.5)",
                        },
                        position: "left",
                        min: 0,
                        border: {
                            display: false,
                        },
                    },
                    x: {
                        type: "linear",
                        min: 0,
                        max: totalDuration,
                        ticks: {
                            color: "rgb(223,223,223)",
                            font: { weight: "bold", size: 18 },
                            maxTicksLimit: 12,
                            maxRotation: 0,
                            callback: (value) => {
                                const totalSeconds = Math.floor(Number(value) / 1000);
                                const minutes = Math.floor(totalSeconds / 60);
                                const seconds = totalSeconds % 60;
                                return `${minutes}:${seconds.toString().padStart(2, "0")}`;
                            },
                        },
                        grid: {
                            color: "rgb(223,223,223)",
                            drawOnChartArea: false,
                        },
                    },
                },
            },
        };

        return await this.chartCanvas.renderToBuffer(configuration);
    }

    //#region Internal

    private downsample(peaks: Array<number>, targetCount: number): Array<number> {
        if (peaks.length <= targetCount) return peaks;

        const bucketSize = peaks.length / targetCount;
        const result: Array<number> = [];

        for (let i = 0; i < targetCount; i++) {
            const start = Math.floor(i * bucketSize);
            const end = Math.floor((i + 1) * bucketSize);
            let max = 0;
            for (let j = start; j < end; j++) {
                if (peaks[j]! > max) max = peaks[j]!;
            }
            result.push(max);
        }

        return result;
    }

    //#endregion
}
