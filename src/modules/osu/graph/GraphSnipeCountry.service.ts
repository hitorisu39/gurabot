import { Import, Trace } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { GraphRendererService } from "./GraphRenderer.service";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { EGraphSize } from "@domain/osu/enums/Graph.enum";
import { graphColors } from "@domain/osu/configs/Graph.config";
import { SnipeRankingPlayerDto } from "@domain/snipe/SnipeRanking.dto";
import { Chart, ChartConfiguration, Plugin } from "chart.js";
import { TextFormatter } from "@domain/discord/formatters/Text.formatter";

interface ISnipeCountryGraphStats {
    weightedPPLeader: SnipeRankingPlayerDto;
    firstPlaceLeader: SnipeRankingPlayerDto;
}

export class GraphSnipeCountryService extends AbstractService {
    @Import() declare private readonly graphRendererService: GraphRendererService;

    @Trace()
    public async render(players: ReadonlyArray<SnipeRankingPlayerDto>): Promise<Buffer> {
        if (!players.length) {
            throw new Exception(EApplicationError.NOT_FOUND, "This country has no osu!snipe ranking data.");
        }

        const sortedByPP = [...players].sort((a, b) => b.weightedPP - a.weightedPP);

        const top = sortedByPP.slice(0, 10);
        const weightedPPLeader = sortedByPP[0]!;

        const firstPlaceLeader = players.reduce((best, player) =>
            player.firstPlaceCount > best.firstPlaceCount ? player : best,
        );

        const stats: ISnipeCountryGraphStats = {
            weightedPPLeader,
            firstPlaceLeader,
        };

        const configuration: ChartConfiguration<"bar", Array<number>, string> = {
            type: "bar",
            plugins: [this.createPlugin(top, stats)],
            data: {
                labels: top.map((player) => TextFormatter.truncate(player.username, 20, "..")),

                datasets: [
                    {
                        label: "Weighted PP",
                        data: top.map((player) => player.weightedPP),
                        backgroundColor: graphColors.accent,
                        borderColor: graphColors.secondary,
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                indexAxis: "y",
                responsive: false,
                animation: false,
                layout: {
                    padding: {
                        top: 58,
                        left: 12,
                        right: 100,
                        bottom: 4,
                    },
                },
                plugins: {
                    legend: {
                        display: false,
                    },
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            color: graphColors.tickText,
                            padding: 10,
                            font: {
                                size: 12,
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
                    y: {
                        ticks: {
                            color: graphColors.axisText,
                            font: {
                                size: 12,
                                weight: "bold",
                            },
                        },
                        grid: {
                            display: false,
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

    private createPlugin(players: ReadonlyArray<SnipeRankingPlayerDto>, stats: ISnipeCountryGraphStats): Plugin<"bar"> {
        return {
            id: "osu_graph_snipe_country",

            beforeDraw: (chart) => {
                const { ctx, width, height } = chart;

                ctx.save();

                ctx.fillStyle = graphColors.background;
                ctx.fillRect(0, 0, width, height);

                ctx.restore();
            },

            afterDatasetsDraw: (chart) => {
                this.drawFirstPlaceCounts(chart, players);
            },

            afterDraw: (chart) => {
                this.drawHeader(chart, stats);
            },
        };
    }

    private drawFirstPlaceCounts(chart: Chart<"bar">, players: ReadonlyArray<SnipeRankingPlayerDto>): void {
        const meta = chart.getDatasetMeta(0);
        const { ctx } = chart;

        ctx.save();

        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = graphColors.text;

        for (const [index, element] of meta.data.entries()) {
            const player = players[index];

            if (!player) {
                continue;
            }

            const { x, y } = element.getProps(["x", "y"], true);

            ctx.fillText(`${DiscordFormatter.number(player.firstPlaceCount)} #1s`, x + 8, y);
        }

        ctx.restore();
    }

    private drawHeader(chart: Chart<"bar">, stats: ISnipeCountryGraphStats): void {
        const { ctx, width } = chart;

        ctx.save();

        ctx.font = "bold 13px sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.fillStyle = graphColors.text;

        const ppLeader =
            `${TextFormatter.truncate(stats.weightedPPLeader.username, 18, "..")}: ` +
            `${DiscordFormatter.number(DiscordFormatter.fixed(stats.weightedPPLeader.weightedPP, 1))} weighted pp`;

        const firstLeader =
            `${TextFormatter.truncate(stats.firstPlaceLeader.username, 18, "..")}: ` +
            `${DiscordFormatter.number(stats.firstPlaceLeader.firstPlaceCount)} #1s`;

        ctx.fillText(`Weighted PP leader — ${ppLeader}    •    Most #1s — ${firstLeader}`, width / 2, 25);

        ctx.restore();
    }
}
