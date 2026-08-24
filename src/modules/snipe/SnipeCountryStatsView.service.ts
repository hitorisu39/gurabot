import { Import } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { GraphSnipeCountryService } from "@/modules/osu/graph/GraphSnipeCountry.service";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { snipeBaseUrl } from "@domain/snipe/configs/Snipe.config";
import { AdapterProvider, GameMode } from "@generated/adapter/types";
import { AttachmentBuilder } from "discord.js";
import { SnipeCountryStatsViewDto } from "@domain/snipe/views/SnipeCountryStats.view";

export class SnipeCountryStatsViewService extends AbstractService {
    @Import() declare private readonly graphSnipeCountryService: GraphSnipeCountryService;

    public async build(data: SnipeCountryStatsViewDto): Promise<TMessagePayload> {
        const { country, statistics, players } = data;

        const weightedPPLeader = [...players].sort((a, b) => b.weightedPP - a.weightedPP).at(0);
        const firstPlaceLeader = [...players].sort((a, b) => b.firstPlaceCount - a.firstPlaceCount).at(0);

        const embed = new Embed()
            .setAuthor({
                name: `osu!snipe • ${country} #1 statistics`,
                iconURL: DiscordFormatter.countryFlag(this.config.app.flagsDomain, country),
                url: `${snipeBaseUrl}/rankings/` + `${country.toLowerCase()}/osu/weighted-pp`,
            })
            .addFields(
                {
                    name: "Most gained",
                    value: this.formatDifference(
                        statistics.mostGainsUsername,
                        statistics.mostGainsUserID,
                        statistics.mostGainsCount,
                    ),
                    inline: true,
                },
                {
                    name: "Most losses",
                    value: this.formatDifference(
                        statistics.mostLossesUsername,
                        statistics.mostLossesUserID,
                        statistics.mostLossesCount,
                    ),
                    inline: true,
                },
            );

        if (weightedPPLeader && firstPlaceLeader) {
            embed.addFields(
                {
                    name: "Weighted PP leader",
                    value:
                        `${this.playerLink(weightedPPLeader.username, weightedPPLeader.userID)}\n` +
                        `\`${DiscordFormatter.number(
                            DiscordFormatter.fixed(weightedPPLeader.weightedPP, 1),
                        )} weighted pp\``,
                    inline: true,
                },
                {
                    name: "Most #1s",
                    value:
                        `${this.playerLink(firstPlaceLeader.username, firstPlaceLeader.userID)}\n` +
                        `\`${DiscordFormatter.number(firstPlaceLeader.firstPlaceCount)} #1s\``,
                    inline: true,
                },
            );
        }

        let footer = `Unplayed maps: ` + DiscordFormatter.number(statistics.unplayedMaps);

        if (statistics.totalMaps !== undefined && statistics.totalMaps > 0) {
            const percentage = (statistics.unplayedMaps / statistics.totalMaps) * 100;

            footer +=
                ` / ${DiscordFormatter.number(statistics.totalMaps)}` + ` (${DiscordFormatter.fixed(percentage, 1)}%)`;
        }

        embed.setFooter({
            text: footer,
        });

        const payload: TMessagePayload = {
            embeds: [embed],
        };

        if (players.length) {
            try {
                const graph = await this.graphSnipeCountryService.render(players);

                embed.setImage("attachment://snipe-country.png");
                payload.files = [
                    new AttachmentBuilder(graph, {
                        name: "snipe-country.png",
                    }),
                ];
            } catch (error) {
                this.logger.error(error, `Failed to render osu!snipe country graph for ${country}`);
            }
        }

        return payload;
    }

    private formatDifference(username?: string, userID?: number, count?: number): string {
        if (!username || userID === undefined || count === undefined) {
            return "Unknown";
        }

        return `${this.playerLink(username, userID)}\n\`${DiscordFormatter.delta(count)}\``;
    }

    private playerLink(username: string, userID: number): string {
        return DiscordFormatter.link(
            username,
            ProfileFormatter.link(AdapterProvider.Bancho, userID, GameMode.Standard),
        );
    }
}
