import { AbstractService } from "@/core/framework/AbstractService";
import { Import, Trace } from "@/core/decorators";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ChartConfiguration, Plugin } from "chart.js";
import { SkillDistributionCategoryDto } from "@domain/osu/Skill.dto";
import { ESkillType } from "@domain/osu/enums/Skill.enum";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { graphColors } from "@domain/osu/configs/Graph.config";
import { GraphRendererService } from "./GraphRenderer.service";
import { EGraphSize } from "@domain/osu/enums/Graph.enum";

interface IGraphSkillCategory {
    type: ESkillType;
    label: string;
    values: Array<number>;
    color: string;
}

export class GraphSkillsCurveService extends AbstractService {
    @Import() declare private readonly graphRendererService: GraphRendererService;

    @Trace()
    public async generate(rawCategories: ReadonlyArray<SkillDistributionCategoryDto>): Promise<Buffer> {
        const categories = this.normalizeCategories(rawCategories);

        if (!categories.length) {
            throw new Exception(EApplicationError.NOT_FOUND, "No valid skill values could be graphed.");
        }

        const maxLength = Math.max(...categories.map((category) => category.values.length));

        if (maxLength <= 0) {
            throw new Exception(EApplicationError.NOT_FOUND, "No valid skill values could be graphed.");
        }

        const labels = Array.from({ length: maxLength }, (_, index) => `#${index + 1}`);

        const configuration: ChartConfiguration<"line", Array<number | null>, string> = {
            type: "line",
            plugins: [this.createPlugin(categories)],
            data: {
                labels,
                datasets: categories.map((category) => ({
                    label: category.label,
                    data: Array.from({ length: maxLength }, (_, index) => category.values.at(index) ?? null),
                    borderColor: category.color,
                    backgroundColor: category.color,
                    borderWidth: 2.25,
                    fill: false,
                    tension: 0.28,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    pointHitRadius: 0,
                    spanGaps: false,
                })),
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
                        grace: "7%",
                        ticks: {
                            color: graphColors.tickText,
                            padding: 10,
                            font: {
                                size: 13,
                                weight: "bold",
                            },
                            callback: (value) => MapFormatter.stars(Number(value)),
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

    private normalizeCategories(
        rawCategories: ReadonlyArray<SkillDistributionCategoryDto>,
    ): Array<IGraphSkillCategory> {
        const categories: Array<IGraphSkillCategory> = [];

        for (const category of rawCategories) {
            const values = category.values
                .filter((value) => Number.isFinite(value) && value >= 0)
                .sort((a, b) => b - a);

            if (!values.length) {
                continue;
            }

            categories.push({
                type: category.type,
                label: category.label,
                values,
                color: this.getSkillColor(category.type),
            });
        }

        return categories;
    }

    //#endregion

    //#region Plugin

    private createPlugin(categories: ReadonlyArray<IGraphSkillCategory>): Plugin<"line"> {
        return {
            id: "osu_graph_skills_curve",

            beforeDraw: (chart) => {
                const { ctx, width, height } = chart;

                ctx.save();
                ctx.fillStyle = graphColors.background;
                ctx.fillRect(0, 0, width, height);
                ctx.restore();
            },

            afterDraw: (chart) => {
                this.drawHeader(chart.ctx, chart.width, categories);
            },
        };
    }

    private drawHeader(
        ctx: CanvasRenderingContext2D,
        width: number,
        categories: ReadonlyArray<IGraphSkillCategory>,
    ): void {
        ctx.save();

        ctx.font = "bold 13px sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        const y = 25;

        const lineWidth = 22;
        const lineTextGap = 9;
        const itemGap = 28;

        const items = categories.map((category) => {
            const text = `${category.label}`;

            return {
                category,
                text,
                textWidth: ctx.measureText(text).width,
            };
        });

        const totalWidth =
            items.reduce((sum, item) => sum + lineWidth + lineTextGap + item.textWidth, 0) +
            itemGap * Math.max(0, items.length - 1);

        let x = Math.max(18, (width - totalWidth) / 2);

        for (const item of items) {
            this.drawLegendLine(ctx, x, y, lineWidth, item.category.color);

            x += lineWidth + lineTextGap;

            ctx.fillStyle = graphColors.text;
            ctx.fillText(item.text, x, y);

            x += item.textWidth + itemGap;
        }

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

    //#endregion

    //#region Colors

    private getSkillColor(type: ESkillType): string {
        switch (type) {
            case ESkillType.Aim:
                return graphColors.skills.aim;
            case ESkillType.Speed:
                return graphColors.skills.speed;
            case ESkillType.Accuracy:
                return graphColors.skills.accuracy;
            case ESkillType.Stamina:
                return graphColors.skills.stamina;
            case ESkillType.Rhythm:
                return graphColors.skills.rhythm;
            case ESkillType.Colour:
                return graphColors.skills.colour;
            case ESkillType.Reading:
                return graphColors.skills.reading;
            case ESkillType.Movement:
                return graphColors.skills.movement;
            case ESkillType.Strain:
                return graphColors.skills.strain;
            default:
                return graphColors.text;
        }
    }

    //#endregion
}
