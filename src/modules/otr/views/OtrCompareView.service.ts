import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { ActionRow } from "@/core/discord/ui/ActionRow";
import { Embed } from "@/core/discord/ui/Embed";
import { SelectMenu } from "@/core/discord/ui/SelectMenu";
import { AbstractViewService } from "@/modules/AbstractViewService";

import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { OtrProfileFormatter } from "@domain/otr/formatters/OtrProfile.formatter";
import { OtrPlayerStatsDto } from "@domain/otr/OtrPlayer.dto";
import { IOtrNormalizedModStats, OtrPlayerAttributesCalculator } from "@domain/otr/utils/OtrPlayerAttributesCalculator";
import { EOtrCompareView, OtrCompareViewDto } from "@domain/otr/views/OtrCompare.view";
import { PopulatedUser } from "@domain/osu/Profile.dto";
import { isValidNumber } from "@domain/utils/utils";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";

type TComparisonDirection = "higher" | "lower";

interface ICompareRow {
    left: string;
    metric: string;
    right: string;

    leftValue?: number | null;
    rightValue?: number | null;

    direction?: TComparisonDirection;
}

export class OtrCompareViewService extends AbstractViewService<OtrCompareViewDto, EOtrCompareView> {
    protected readonly ttl = 120;

    public build(
        sessionID: string,
        data: OtrCompareViewDto,
        view: EOtrCompareView = EOtrCompareView.Overview,
    ): TMessagePayload {
        const left = this.playerLink(data.leftProfile, data.leftStats);
        const right = this.playerLink(data.rightProfile, data.rightStats);

        return {
            content: `o!TR comparison: ${left} vs ${right}`,
            embeds: [this.view(data, view)],
            components: this.components(sessionID, view),
        };
    }

    //#region Views

    public overview(data: OtrCompareViewDto): Embed {
        const left = data.leftStats;
        const right = data.rightStats;

        const l = left.rating;
        const r = right.rating;

        const rows: Array<ICompareRow> = [
            this.compareRow(
                "Rating",
                this.ratingOrNA(l?.rating),
                this.ratingOrNA(r?.rating),
                l?.rating,
                r?.rating,
                "higher",
            ),
            this.compareRow(
                "Global Rank",
                this.rankOrNA(l?.globalRank),
                this.rankOrNA(r?.globalRank),
                this.validRank(l?.globalRank),
                this.validRank(r?.globalRank),
                "lower",
            ),
            this.compareRow(
                "Country Rank",
                this.rankOrNA(l?.countryRank),
                this.rankOrNA(r?.countryRank),
                this.validRank(l?.countryRank),
                this.validRank(r?.countryRank),
                "lower",
            ),
            this.compareRow(
                "Peak Rating",
                this.ratingOrNA(left.matchStats?.highestRating),
                this.ratingOrNA(right.matchStats?.highestRating),
                left.matchStats?.highestRating,
                right.matchStats?.highestRating,
                "higher",
            ),
            this.compareRow(
                "Tier",
                l ? OtrProfileFormatter.tier(l.tierProgress.currentTier, l.tierProgress.currentSubTier) : "—",
                r ? OtrProfileFormatter.tier(r.tierProgress.currentTier, r.tierProgress.currentSubTier) : "—",
            ),
            this.compareRow("Volatility", this.numberOrNA(l?.volatility, 2), this.numberOrNA(r?.volatility, 2)),
            this.compareRow(
                "Tournaments",
                this.numberOrNA(l?.tournamentsPlayed),
                this.numberOrNA(r?.tournamentsPlayed),
            ),
            this.compareRow("Matches", this.numberOrNA(l?.matchesPlayed), this.numberOrNA(r?.matchesPlayed)),
            this.compareRow(
                "Status",
                l ? (l.isProvisional ? "Provisional" : "Established") : "—",
                r ? (r.isProvisional ? "Provisional" : "Established") : "—",
            ),
        ];

        return this.renderComparison(data, rows);
    }

    public performance(data: OtrCompareViewDto): Embed {
        const left = data.leftStats.matchStats;
        const right = data.rightStats.matchStats;

        if (!left && !right) {
            return new Embed().setDescription("Tournament performance statistics are unavailable for both players.");
        }

        const leftMatchWinRate = left ? OtrPlayerAttributesCalculator.winRate(left.matchesWon, left.matchesLost) : null;
        const rightMatchWinRate = right
            ? OtrPlayerAttributesCalculator.winRate(right.matchesWon, right.matchesLost)
            : null;

        const leftGameWinRate = left ? OtrPlayerAttributesCalculator.winRate(left.gamesWon, left.gamesLost) : null;
        const rightGameWinRate = right ? OtrPlayerAttributesCalculator.winRate(right.gamesWon, right.gamesLost) : null;

        const rows: Array<ICompareRow> = [
            this.compareRow(
                "Match Record",
                left ? OtrProfileFormatter.record(left.matchesWon, left.matchesLost) : "—",
                right ? OtrProfileFormatter.record(right.matchesWon, right.matchesLost) : "—",
            ),
            this.compareRow(
                "Match Win Rate",
                this.percentOrNA(leftMatchWinRate),
                this.percentOrNA(rightMatchWinRate),
                leftMatchWinRate,
                rightMatchWinRate,
                "higher",
            ),
            this.compareRow(
                "Game Record",
                left ? OtrProfileFormatter.record(left.gamesWon, left.gamesLost) : "—",
                right ? OtrProfileFormatter.record(right.gamesWon, right.gamesLost) : "—",
            ),
            this.compareRow(
                "Game Win Rate",
                this.percentOrNA(leftGameWinRate),
                this.percentOrNA(rightGameWinRate),
                leftGameWinRate,
                rightGameWinRate,
                "higher",
            ),
            this.compareRow(
                "Avg Match Cost",
                this.numberOrNA(left?.averageMatchCostAggregate, 3),
                this.numberOrNA(right?.averageMatchCostAggregate, 3),
                left?.averageMatchCostAggregate,
                right?.averageMatchCostAggregate,
                "higher",
            ),
            this.compareRow(
                "Avg Score",
                this.numberOrNA(left?.matchAverageScoreAggregate),
                this.numberOrNA(right?.matchAverageScoreAggregate),
                left?.matchAverageScoreAggregate,
                right?.matchAverageScoreAggregate,
                "higher",
            ),
            this.compareRow(
                "Avg Accuracy",
                this.percentOrNA(left?.matchAverageAccuracyAggregate),
                this.percentOrNA(right?.matchAverageAccuracyAggregate),
                left?.matchAverageAccuracyAggregate,
                right?.matchAverageAccuracyAggregate,
                "higher",
            ),
            this.compareRow(
                "Avg Misses",
                this.numberOrNA(left?.matchAverageMissesAggregate, 2),
                this.numberOrNA(right?.matchAverageMissesAggregate, 2),
                left?.matchAverageMissesAggregate,
                right?.matchAverageMissesAggregate,
                "lower",
            ),
            this.compareRow(
                "Avg Placement",
                this.numberOrNA(left?.averagePlacingAggregate, 2),
                this.numberOrNA(right?.averagePlacingAggregate, 2),
                left?.averagePlacingAggregate,
                right?.averagePlacingAggregate,
                "lower",
            ),
            this.compareRow(
                "Avg Games",
                this.numberOrNA(left?.averageGamesPlayedAggregate, 2),
                this.numberOrNA(right?.averageGamesPlayedAggregate, 2),
            ),
            this.compareRow(
                "Best Streak",
                this.numberOrNA(left?.bestWinStreak),
                this.numberOrNA(right?.bestWinStreak),
                left?.bestWinStreak,
                right?.bestWinStreak,
                "higher",
            ),
            this.compareRow(
                "Rating Gained",
                left ? DiscordFormatter.delta(DiscordFormatter.fixed(left.ratingGained)) : "—",
                right ? DiscordFormatter.delta(DiscordFormatter.fixed(right.ratingGained)) : "—",
                left?.ratingGained,
                right?.ratingGained,
                "higher",
            ),
        ];

        return this.renderComparison(data, rows);
    }

    public mods(data: OtrCompareViewDto): Embed {
        const left = OtrPlayerAttributesCalculator.normalizeModStats(data.leftStats.modStats);
        const right = OtrPlayerAttributesCalculator.normalizeModStats(data.rightStats.modStats);

        const leftOrdered = [...left].sort((a, b) => b.count - a.count);
        const rightOrdered = [...right].sort((a, b) => b.count - a.count);

        const leftTotal = left.reduce((sum, stat) => sum + stat.count, 0);
        const rightTotal = right.reduce((sum, stat) => sum + stat.count, 0);

        const rows: Array<ICompareRow> = [
            this.compareRow("Games", DiscordFormatter.number(leftTotal), DiscordFormatter.number(rightTotal)),
            this.compareRow("Unique Mods", DiscordFormatter.number(left.length), DiscordFormatter.number(right.length)),
            ...this.modRows(leftOrdered, rightOrdered, leftTotal, rightTotal),
        ];

        return this.renderComparison(data, rows);
    }

    public experience(data: OtrCompareViewDto): Embed {
        const left = data.leftStats;
        const right = data.rightStats;

        const l = left.rating;
        const r = right.rating;

        const leftGames = left.matchStats ? left.matchStats.gamesWon + left.matchStats.gamesLost : null;

        const rightGames = right.matchStats ? right.matchStats.gamesWon + right.matchStats.gamesLost : null;

        const rows: Array<ICompareRow> = [
            this.compareRow(
                "Tournaments",
                this.numberOrNA(l?.tournamentsPlayed),
                this.numberOrNA(r?.tournamentsPlayed),
                l?.tournamentsPlayed,
                r?.tournamentsPlayed,
                "higher",
            ),
            this.compareRow(
                "Matches",
                this.numberOrNA(l?.matchesPlayed),
                this.numberOrNA(r?.matchesPlayed),
                l?.matchesPlayed,
                r?.matchesPlayed,
                "higher",
            ),
            this.compareRow(
                "Games",
                this.numberOrNA(leftGames),
                this.numberOrNA(rightGames),
                leftGames,
                rightGames,
                "higher",
            ),
            this.compareRow(
                "Rating Changes",
                this.numberOrNA(l?.adjustments.length),
                this.numberOrNA(r?.adjustments.length),
                l?.adjustments.length,
                r?.adjustments.length,
                "higher",
            ),
            this.compareRow(
                "Peak Rating",
                this.ratingOrNA(left.matchStats?.highestRating),
                this.ratingOrNA(right.matchStats?.highestRating),
                left.matchStats?.highestRating,
                right.matchStats?.highestRating,
                "higher",
            ),
            this.compareRow(
                "Best Streak",
                this.numberOrNA(left.matchStats?.bestWinStreak),
                this.numberOrNA(right.matchStats?.bestWinStreak),
                left.matchStats?.bestWinStreak,
                right.matchStats?.bestWinStreak,
                "higher",
            ),
            this.compareRow(
                "Status",
                l ? (l.isProvisional ? "Provisional" : "Established") : "—",
                r ? (r.isProvisional ? "Provisional" : "Established") : "—",
            ),
        ];

        return this.renderComparison(data, rows);
    }

    public matchup(data: OtrCompareViewDto): Embed {
        const left = data.leftStats;
        const right = data.rightStats;

        const l = left.rating;
        const r = right.rating;

        const leftMatches = left.matchStats;
        const rightMatches = right.matchStats;

        const leftTrend = l ? OtrPlayerAttributesCalculator.recentRatingTrend(l.adjustments) : null;
        const rightTrend = r ? OtrPlayerAttributesCalculator.recentRatingTrend(r.adjustments) : null;

        const leftWinRate = leftMatches
            ? OtrPlayerAttributesCalculator.winRate(leftMatches.matchesWon, leftMatches.matchesLost)
            : null;

        const rightWinRate = rightMatches
            ? OtrPlayerAttributesCalculator.winRate(rightMatches.matchesWon, rightMatches.matchesLost)
            : null;

        const leftMods = OtrPlayerAttributesCalculator.normalizeModStats(left.modStats);
        const rightMods = OtrPlayerAttributesCalculator.normalizeModStats(right.modStats);

        const leftFavorite = OtrPlayerAttributesCalculator.favoriteMod(leftMods);
        const rightFavorite = OtrPlayerAttributesCalculator.favoriteMod(rightMods);

        const leftFavoriteUsage = leftFavorite ? OtrPlayerAttributesCalculator.modUsage(leftMods, leftFavorite) : null;
        const rightFavoriteUsage = rightFavorite
            ? OtrPlayerAttributesCalculator.modUsage(rightMods, rightFavorite)
            : null;

        const rows: Array<ICompareRow> = [
            this.compareRow(
                "Rating",
                this.ratingOrNA(l?.rating),
                this.ratingOrNA(r?.rating),
                l?.rating,
                r?.rating,
                "higher",
            ),
            this.compareRow(
                "Recent Rating",
                leftTrend?.count ? DiscordFormatter.delta(DiscordFormatter.fixed(leftTrend.change)) : "—",
                rightTrend?.count ? DiscordFormatter.delta(DiscordFormatter.fixed(rightTrend.change)) : "—",
                leftTrend?.count ? leftTrend.change : null,
                rightTrend?.count ? rightTrend.change : null,
                "higher",
            ),
            this.compareRow(
                "Match Win Rate",
                this.percentOrNA(leftWinRate),
                this.percentOrNA(rightWinRate),
                leftWinRate,
                rightWinRate,
                "higher",
            ),
            this.compareRow(
                "Avg Match Cost",
                this.numberOrNA(leftMatches?.averageMatchCostAggregate, 3),
                this.numberOrNA(rightMatches?.averageMatchCostAggregate, 3),
                leftMatches?.averageMatchCostAggregate,
                rightMatches?.averageMatchCostAggregate,
                "higher",
            ),
            this.compareRow(
                "Avg Placement",
                this.numberOrNA(leftMatches?.averagePlacingAggregate, 2),
                this.numberOrNA(rightMatches?.averagePlacingAggregate, 2),
                leftMatches?.averagePlacingAggregate,
                rightMatches?.averagePlacingAggregate,
                "lower",
            ),
            this.compareRow("Favorite Mod", leftFavorite?.mods ?? "—", rightFavorite?.mods ?? "—"),
            this.compareRow("Favorite Use", this.percentOrNA(leftFavoriteUsage), this.percentOrNA(rightFavoriteUsage)),
            this.compareRow("Matches", this.numberOrNA(l?.matchesPlayed), this.numberOrNA(r?.matchesPlayed)),
            this.compareRow("Volatility", this.numberOrNA(l?.volatility, 2), this.numberOrNA(r?.volatility, 2)),
        ];

        return this.renderComparison(data, rows);
    }

    //#endregion

    //#region Components

    private components(sessionID: string, view: EOtrCompareView): Array<ActionRow> {
        const menu = new SelectMenu(`otr_compare:${sessionID}`)
            .setCurrent(view)
            .addChoice("Overview", EOtrCompareView.Overview, "Rating comparison")
            .addChoice("Performance", EOtrCompareView.Performance, "Tournament performance comparison")
            .addChoice("Mods", EOtrCompareView.Mods, "Tournament mod comparison")
            .addChoice("Experience", EOtrCompareView.Experience, "Tournament experience comparison")
            .addChoice("Matchup", EOtrCompareView.Matchup, "Competitive matchup summary");

        return [new ActionRow().add(menu)];
    }

    //#endregion

    //#region Routing

    private view(data: OtrCompareViewDto, view: EOtrCompareView): Embed {
        switch (view) {
            case EOtrCompareView.Performance:
                return this.performance(data);
            case EOtrCompareView.Mods:
                return this.mods(data);
            case EOtrCompareView.Experience:
                return this.experience(data);
            case EOtrCompareView.Matchup:
                return this.matchup(data);
            case EOtrCompareView.Overview:
            default:
                return this.overview(data);
        }
    }

    //#endregion

    //#region Comparison

    private renderComparison(data: OtrCompareViewDto, rows: ReadonlyArray<ICompareRow>): Embed {
        return new Embed().addFields(
            {
                name: data.leftProfile.username,
                value: this.renderPlayerGrid(rows, "left"),
                inline: true,
            },
            {
                name: data.rightProfile.username,
                value: this.renderPlayerGrid(rows, "right"),
                inline: true,
            },
        );
    }

    private renderPlayerGrid(rows: ReadonlyArray<ICompareRow>, side: "left" | "right"): string {
        return DiscordFormatter.formatInlineGrid(
            rows.map((row) => ({
                label: `${this.isWinner(row, side) ? "◆ " : "  "}${row.metric}`,
                value: row[side],
            })),
            1,
            40,
            " ",
            19,
            15,
        );
    }

    private isWinner(row: ICompareRow, side: "left" | "right"): boolean {
        if (
            !row.direction ||
            !isValidNumber(row.leftValue) ||
            !isValidNumber(row.rightValue) ||
            row.leftValue === row.rightValue
        ) {
            return false;
        }

        const leftWins = row.direction === "higher" ? row.leftValue > row.rightValue : row.leftValue < row.rightValue;

        return side === "left" ? leftWins : !leftWins;
    }

    private compareRow(
        metric: string,
        left: string,
        right: string,
        leftValue?: number | null,
        rightValue?: number | null,
        direction?: TComparisonDirection,
    ): ICompareRow {
        return {
            metric,
            left,
            right,
            leftValue,
            rightValue,
            direction,
        };
    }

    //#endregion

    //#region Mods

    private modRows(
        left: ReadonlyArray<IOtrNormalizedModStats>,
        right: ReadonlyArray<IOtrNormalizedModStats>,
        leftTotal: number,
        rightTotal: number,
    ): Array<ICompareRow> {
        const rows: Array<ICompareRow> = [];

        for (let i = 0; i < 5; i++) {
            const l = left[i];
            const r = right[i];
            const placement = i + 1;

            rows.push(this.compareRow(`#${placement} Mod`, l?.mods ?? "—", r?.mods ?? "—"));

            rows.push(
                this.compareRow(
                    `#${placement} Use`,
                    l && leftTotal ? this.percentOrNA((l.count / leftTotal) * 100) : "—",
                    r && rightTotal ? this.percentOrNA((r.count / rightTotal) * 100) : "—",
                ),
            );

            rows.push(
                this.compareRow(
                    `#${placement} Avg`,
                    l ? DiscordFormatter.number(Math.round(l.averageScore)) : "—",
                    r ? DiscordFormatter.number(Math.round(r.averageScore)) : "—",
                ),
            );
        }

        return rows;
    }

    //#endregion

    //#region Formatting

    private validRank(rank?: number | null): number | null {
        return rank && rank > 0 ? rank : null;
    }

    private numberOrNA(value?: number | null, decimals: number = 0): string {
        if (!isValidNumber(value)) return "—";

        const formatted = DiscordFormatter.fixed(value, decimals);
        return DiscordFormatter.number(formatted);
    }

    private ratingOrNA(value?: number | null): string {
        return isValidNumber(value) ? OtrProfileFormatter.rating(value) : "—";
    }

    private rankOrNA(value?: number | null): string {
        return value && value > 0 ? ProfileFormatter.rank(value) : "—";
    }

    private percentOrNA(value?: number | null, decimals: number = 1): string {
        return isValidNumber(value) ? `${DiscordFormatter.fixed(value, decimals)}%` : "—";
    }

    private playerLink(profile: PopulatedUser, stats: OtrPlayerStatsDto): string {
        return DiscordFormatter.link(
            profile.username,
            OtrProfileFormatter.link(stats.playerInfo.id, stats.ruleset),
            null,
            true,
        );
    }

    //#endregion
}
