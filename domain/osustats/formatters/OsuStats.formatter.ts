import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { GameMode } from "@generated/adapter/types";
import { EOsuStatsScoreSort } from "../enums/OsuStatsScores.enum";
import { ESortOrder } from "@domain/osu/enums/Score.enum";
import { EModMatchType } from "@domain/core/Command";
import { OsuStatsScoresRequestDto } from "../OsuStatsScores.dto";
import { OsuStatsPlayerDto } from "../OsuStatsPlayers.dto";
import { EOsuStatsBestSort, EOsuStatsBestTimeframe } from "../enums/OsuStatsBest.enum";

export class OsuStatsFormatter {
    public static player(player: OsuStatsPlayerDto): string {
        const username = DiscordFormatter.link(player.username, `https://osu.ppy.sh/users/${player.userID}`);
        return `#${player.rank} ${username}: ${DiscordFormatter.number(player.count)}`;
    }

    public static playersFilters(
        mode: GameMode,
        country: string | undefined,
        minRank: number,
        maxRank: number,
    ): string {
        const countryText = country ? `${country}` : "Global";
        const rankText = minRank === maxRank ? `#${minRank}` : `${minRank} - ${maxRank}`;

        return [
            `Mode: \`${ProfileFormatter.mode(mode, true)}\``,
            `Country: \`${countryText}\``,
            `Rank: \`${rankText}\``,
        ].join(" • ");
    }

    public static scoresFilters(data: OsuStatsScoresRequestDto): string {
        const values = [
            `Rank: \`${this.range(data.minRank, data.maxRank)}\``,
            `Accuracy: \`${this.range(data.minAccuracy, data.maxAccuracy, "%")}\``,
            `Sort: \`${this.scoreSort(data.sort)} ${this.order(data.order)}\``,
        ];

        if (data.modType && data.mods !== undefined) {
            values.push(`Mods: \`${this.mods(data.modType, data.mods)}\``);
        }

        return values.join(" • ");
    }

    private static range(min: number, max: number, suffix = ""): string {
        if (min === max) {
            return `${DiscordFormatter.fixed(min)}${suffix}`;
        }

        return `${DiscordFormatter.fixed(min)}${suffix} - ${DiscordFormatter.fixed(max)}${suffix}`;
    }

    private static scoreSort(sort: EOsuStatsScoreSort): string {
        switch (sort) {
            case EOsuStatsScoreSort.Accuracy:
                return "Accuracy";
            case EOsuStatsScoreSort.Combo:
                return "Combo";
            case EOsuStatsScoreSort.Misses:
                return "Misses";
            case EOsuStatsScoreSort.PP:
                return "PP";
            case EOsuStatsScoreSort.Rank:
                return "Rank";
            case EOsuStatsScoreSort.Score:
                return "Score";
            default:
                return "Date";
        }
    }

    public static bestFilters(
        mode: GameMode,
        timeframe: EOsuStatsBestTimeframe,
        sort: EOsuStatsBestSort,
        order: ESortOrder,
    ): string {
        return [
            `Mode: \`${ProfileFormatter.mode(mode)}\``,
            `Timeframe: \`${this.timeframe(timeframe)}\``,
            `Sort: \`${this.bestSort(sort)} ${this.order(order)}\``,
        ].join(" • ");
    }

    public static timeframe(timeframe: EOsuStatsBestTimeframe): string {
        switch (timeframe) {
            case EOsuStatsBestTimeframe.LastWeek:
                return "Last week";
            case EOsuStatsBestTimeframe.LastMonth:
                return "Last month";
            default:
                return "Yesterday";
        }
    }

    public static bestSort(sort: EOsuStatsBestSort): string {
        switch (sort) {
            case EOsuStatsBestSort.Accuracy:
                return "Accuracy";
            case EOsuStatsBestSort.Combo:
                return "Combo";
            case EOsuStatsBestSort.Date:
                return "Date";
            case EOsuStatsBestSort.LeaderboardPosition:
                return "Leaderboard position";
            case EOsuStatsBestSort.Misses:
                return "Misses";
            case EOsuStatsBestSort.Score:
                return "Score";
            default:
                return "PP";
        }
    }

    private static order(order: ESortOrder): string {
        return order === ESortOrder.Ascending ? "Asc" : "Desc";
    }

    private static mods(type: EModMatchType, mods: string): string {
        const value = mods || "NM";
        switch (type) {
            case EModMatchType.Match:
                return value;
            case EModMatchType.Exclude:
                return `Exclude ${value}`;
            default:
                return `Include ${value}`;
        }
    }
}
