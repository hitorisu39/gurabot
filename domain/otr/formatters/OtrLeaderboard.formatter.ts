import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { OtrLeaderboardEntryDto } from "@domain/otr/OtrLeaderboard.dto";
import { OtrProfileFormatter } from "./OtrProfile.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";

export class OtrLeaderboardFormatter {
    public static entries(entries: ReadonlyArray<OtrLeaderboardEntryDto>, countryRanks = false): string {
        if (!entries.length) return "No rated players match these filters.";

        const rows = entries.map((entry) => ({
            entry,
            rank: ProfileFormatter.rank(countryRanks ? entry.countryRank : entry.globalRank),
            username: this.codeLabel(entry.player.username || entry.player.osuId.toString()),
            tier: this.codeLabel(
                OtrProfileFormatter.tier(entry.tierProgress.currentTier, entry.tierProgress.currentSubTier),
            ),
            rating: `${OtrProfileFormatter.rating(entry.rating)} TR`,
        }));

        return rows
            .map(({ entry, rank, username, tier, rating }) => {
                const flag = DiscordFormatter.countryEmoji(entry.player.country);
                const profile = DiscordFormatter.link(
                    username,
                    OtrProfileFormatter.link(entry.player.id, entry.ruleset),
                    null,
                    true,
                );

                const header = [`\`${rank}\``, `${flag}${profile}`, `\`${tier}\``, `\`${rating}\``].join(" ");
                const detail = [
                    `Tournaments: \`${DiscordFormatter.number(entry.tournamentsPlayed)}\``,
                    `Matches: \`${DiscordFormatter.number(entry.matchesPlayed)}\``,
                    `Win Rate: \`${Math.round(entry.winRate * 100)}%\``,
                ].join(" • ");

                return `${header}\n> ${detail}`;
            })
            .join("\n");
    }

    private static codeLabel(value: string): string {
        return value
            .replace(/[`\r\n\t]/g, " ")
            .replace(/\[/g, "［")
            .replace(/\]/g, "］");
    }
}
