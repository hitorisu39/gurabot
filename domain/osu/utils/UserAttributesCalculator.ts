import { GameMode, MatchmakingStats, User } from "@generated/adapter/types";
import { PopulatedUser } from "../Profile.dto";

const TO_NEXT_LEVEL: ReadonlyArray<number> = [
    30000, 100000, 210000, 360000, 550000, 780000, 1050000, 1360000, 1710000, 2100000, 2530000, 3000000, 3510000,
    4060000, 4650000, 5280000, 5950000, 6660000, 7410000, 8200000, 9030000, 9900000, 10810000, 11760000, 12750000,
    13780000, 14850000, 15960000, 17110000, 18300000, 19530000, 20800000, 22110000, 23460000, 24850000, 26280000,
    27750000, 29260000, 30810000, 32400000, 34030000, 35700000, 37410000, 39160000, 40950000, 42780000, 44650000,
    46560000, 48510000, 50500000, 52530000, 54600000, 56710000, 58860000, 61050000, 63280000, 65550000, 67860000,
    70210001, 72600001, 75030002, 77500003, 80010006, 82560010, 85150019, 87780034, 90450061, 93160110, 95910198,
    98700357, 101530643, 104401157, 107312082, 110263748, 113256747, 116292144, 119371859, 122499346, 125680824,
    128927482, 132259468, 135713043, 139353477, 143298259, 147758866, 153115959, 160054726, 169808506, 184597311,
    208417160, 248460887, 317675597, 439366075, 655480935, 1041527682, 1733419828, 2975801691, 5209033044, 9225761479,
    99999999999, 99999999999, 99999999999, 99999999999, 99999999999, 99999999999, 99999999999, 99999999999, 99999999999,
    99999999999, 99999999999, 99999999999, 99999999999, 99999999999, 99999999999, 99999999999, 99999999999, 99999999999,
    99999999999, 99999999999, 99999999999, 99999999999, 99999999999, 99999999999,
];

export class UserAttributesCalculator {
    // See https://github.com/ppy/osu-web/blob/37b7b9bb612a144206e7a39b3eefc6694890331a/app/Models/UserStatistics/Model.php#L87
    public static recommended(user: PopulatedUser): number {
        if (user.statistics.pp > 0) {
            switch (user.mode) {
                case GameMode.Taiko:
                    return Math.pow(user.statistics.pp, 0.35) * 0.27;
                default:
                    return Math.pow(user.statistics.pp, 0.4) * 0.195;
            }
        }

        return 1.0;
    }

    // See https://github.com/ppy/osu-queue-score-statistics/blob/master/osu.Server.Queues.ScoreStatisticsProcessor/Processors/UserTotalPerformanceProcessor.cs#L62
    public static bonus(user: User): number {
        const grades = user.statistics.grades;
        const bonus = Math.pow(0.995, Math.min(1000, grades.ssh + grades.ss + grades.sh + grades.s + grades.a));
        return Math.round(100.0 * 416.6667 * (1.0 - bonus)) / 100.0;
    }

    public static legacyBonus(playcount: number): number {
        return (417 - 1 / 3) * (1 - Math.pow(0.995, playcount));
    }

    public static watchedReplays(user: User): number {
        if (!user.replaysWatchedCounts?.length) return 0;

        return user.replaysWatchedCounts.reduce((sum, entry) => sum + entry.count, 0);
    }

    public static calculateLevel(totalScore: number): number {
        let remainingScore = totalScore;
        let level = 0;

        while (remainingScore > 0) {
            const requirementIndex = Math.min(TO_NEXT_LEVEL.length - 1, Math.round(level));
            const nextLevelRequirement = TO_NEXT_LEVEL[requirementIndex];

            level += Math.min(1, remainingScore / nextLevelRequirement!);

            remainingScore -= nextLevelRequirement!;
        }

        return level + 1;
    }

    // See https://github.com/ppy/osu-queue-score-statistics/blob/master/osu.Server.Queues.ScoreStatisticsProcessor/Processors/TotalScoreProcessor.cs#L14
    public static getScoreForNextLevel(currentTotalScore: number): number {
        const currentLevelWithProgress = UserAttributesCalculator.calculateLevel(currentTotalScore);
        const currentIntegerLevel = Math.floor(currentLevelWithProgress);

        const nextIntegerLevel = currentIntegerLevel + 1;

        let targetTotalScore = 0;
        for (let i = 0; i < nextIntegerLevel - 1; i++) {
            const requirementIndex = Math.min(TO_NEXT_LEVEL.length - 1, i);
            targetTotalScore += TO_NEXT_LEVEL[requirementIndex]!;
        }

        const scoreNeeded = targetTotalScore - currentTotalScore;
        return Math.max(0, scoreNeeded);
    }

    public static accountAgeMonths(user: User, now: Date = new Date()): number {
        const joined = new Date(user.joinDate);

        const difference = Math.max(0, now.getTime() - joined.getTime());
        const monthMilliseconds = 30.4375 * 24 * 60 * 60 * 1000;

        return Math.max(1, difference / monthMilliseconds);
    }

    public static ppPerAccountMonth(user: User, now: Date = new Date()): number {
        return user.statistics.pp / this.accountAgeMonths(user, now);
    }

    public static averageMonthlyPlaycount(user: User, months?: number): number | null {
        const entries = this.monthlyEntries(user.monthlyPlaycounts, months);

        if (!entries.length) {
            return null;
        }

        return entries.reduce((sum, entry) => sum + entry.count, 0) / entries.length;
    }

    public static peakMonthlyPlaycount(user: User): { startDate: string; count: number } | null {
        if (!user.monthlyPlaycounts?.length) {
            return null;
        }

        return user.monthlyPlaycounts.reduce((best, entry) => {
            return entry.count > best.count ? entry : best;
        });
    }

    public static activePlaycountMonths(user: User): number {
        return user.monthlyPlaycounts?.filter((entry) => entry.count > 0).length ?? 0;
    }

    public static averageMonthlyReplaysWatched(user: User, months?: number): number | null {
        const entries = this.monthlyEntries(user.replaysWatchedCounts, months);

        if (!entries.length) {
            return null;
        }

        return entries.reduce((sum, entry) => sum + entry.count, 0) / entries.length;
    }

    public static peakMonthlyReplaysWatched(user: User): { startDate: string; count: number } | null {
        if (!user.replaysWatchedCounts?.length) {
            return null;
        }

        return user.replaysWatchedCounts.reduce((best, entry) => {
            return entry.count > best.count ? entry : best;
        });
    }

    private static monthlyEntries<T extends { startDate: string; count: number }>(
        entries: ReadonlyArray<T> | undefined,
        months?: number,
    ): Array<T> {
        if (!entries?.length) {
            return [];
        }

        const sorted = [...entries].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

        if (months === undefined) {
            return sorted;
        }

        return sorted.slice(-months);
    }

    public static currentMatchmaking(user: User): MatchmakingStats | null {
        const stats = user.matchmakingStats;

        if (!stats?.length) {
            return null;
        }

        return stats.find((entry) => entry.pool?.active) ?? [...stats].sort((a, b) => b.poolID - a.poolID)[0] ?? null;
    }
}
