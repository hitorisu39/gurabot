import { Import } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { GraphSnipePlayerHistoryService } from "@/modules/osu/graph/GraphSnipePlayerHistory.service";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { AttachmentBuilder } from "discord.js";
import { SnipePlayerStatsViewDto } from "@domain/snipe/views/SnipePlayerStats.view";
import { snipeBaseUrl } from "@domain/snipe/configs/Snipe.config";
import { ProfileViewService } from "../osu/profile/ProfileView.service";

export class SnipePlayerStatsViewService extends AbstractService {
    @Import() declare private readonly graphSnipePlayerHistoryService: GraphSnipePlayerHistoryService;
    @Import() declare private readonly profileViewService: ProfileViewService;

    public async build(data: SnipePlayerStatsViewDto): Promise<TMessagePayload> {
        const { player, profile } = data;

        const embed = this.profileViewService
            .createBaseEmbed(profile, null, false)
            .setTitle("National #1 statistics")
            .setURL(`${snipeBaseUrl}/player/` + `${profile.countryCode.toLowerCase()}/osu/${profile.id}`)
            .setDescription(
                `**${DiscordFormatter.number(player.firstPlaceCount)} national #1s**` +
                    ` • \`${DiscordFormatter.number(player.rankedFirstPlaceCount)} ranked\`` +
                    ` \`${DiscordFormatter.number(player.lovedFirstPlaceCount)} loved\`\n` +
                    `\`${DiscordFormatter.fixed(player.averagePP, 1)} avg pp\`` +
                    ` \`${DiscordFormatter.fixed(player.averageAccuracy, 2)}% avg\`` +
                    ` \`${DiscordFormatter.fixed(player.averageStars, 2)}★ avg\`\n` +
                    `Change since last update: **${DiscordFormatter.delta(player.recentHistoryDifference)}**`,
            )
            .addFields(
                {
                    name: "Most used mods",
                    value: this.formatMods(player.modCounts),
                    inline: false,
                },
                {
                    name: "Star spread",
                    value: this.formatStarSpread(player.starRatingSpread),
                    inline: false,
                },
            );

        const payload: TMessagePayload = {
            embeds: [embed],
        };

        if (data.history.entries.length) {
            try {
                const graph = await this.graphSnipePlayerHistoryService.render(data.history.entries);
                embed.setImage("attachment://snipe-history.png");
                payload.files = [
                    new AttachmentBuilder(graph, {
                        name: "snipe-history.png",
                    }),
                ];
            } catch (error) {
                this.logger.error(error, `Failed to render snipe history for ${profile.id}`);
            }
        }

        return payload;
    }

    private formatMods(counts: Record<string, number>): string {
        const entries = Object.entries(counts)
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        if (!entries.length) {
            return "None";
        }

        return entries.map(([mods, count]) => `\`${mods} ${DiscordFormatter.number(count)}\``).join(" ");
    }

    private formatStarSpread(spread: Record<string, number>): string {
        const entries = Object.entries(spread)
            .map(([stars, count]) => ({
                stars: Number(stars),
                count,
            }))
            .filter(({ stars, count }) => Number.isFinite(stars) && stars >= 0 && count > 0)
            .sort((a, b) => a.stars - b.stars);

        if (!entries.length) {
            return "None";
        }

        return entries.map(({ stars, count }) => `\`${stars}★ ${DiscordFormatter.number(count)}\``).join(" ");
    }
}
