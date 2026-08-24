import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { SnipeRankingPlayerDto } from "@domain/snipe/SnipeRanking.dto";

import { AdapterProvider, GameMode } from "@generated/adapter/types";

export class SnipeFormatter {
    public static rankingPlayer(player: SnipeRankingPlayerDto, rank: number): string {
        const username = DiscordFormatter.link(
            player.username,
            ProfileFormatter.link(AdapterProvider.Bancho, player.userID, GameMode.Standard),
        );

        const averagePP =
            player.averagePP === null ? "N/A avg pp" : `${DiscordFormatter.fixed(player.averagePP, 1)} avg pp`;

        return (
            `${rank}\\. **${username}**: ` +
            `**${DiscordFormatter.fixed(player.weightedPP, 1)}** weighted pp • ` +
            `\`${DiscordFormatter.number(player.firstPlaceCount)} #1s\` ` +
            `\`${averagePP}\` ` +
            `\`${DiscordFormatter.fixed(player.averageStars, 2)}★ avg\``
        );
    }
}
