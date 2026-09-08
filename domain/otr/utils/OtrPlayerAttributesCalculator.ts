import { ModUtils } from "@generated/adapter/mods";
import { OtrPlayerModStatsDto, OtrPlayerRatingAdjustmentDto } from "../OtrPlayer.dto";
import { isValidDate } from "@domain/utils/dateTimeUtils";
import { isValidNumber } from "@domain/utils/utils";

export interface IOtrRatingHistoryStats {
    current: number;
    peak: number;
    change: number;
    largestGain: number;
    largestLoss: number;
    adjustmentCount: number;
}

export interface IOtrNormalizedModStats {
    mods: string;
    count: number;
    averageScore: number;
}

export interface IOtrRecentRatingTrend {
    change: number;
    count: number;
}

export interface IOtrHeadToHeadStats {
    leftWins: number;
    rightWins: number;
    draws: number;
    matches: number;
}

export class OtrPlayerAttributesCalculator {
    public static ratingHistory(
        adjustments: ReadonlyArray<OtrPlayerRatingAdjustmentDto>,
    ): IOtrRatingHistoryStats | null {
        const history = adjustments
            .filter(
                (adjustment) =>
                    isValidDate(adjustment.timestamp) &&
                    isValidNumber(adjustment.ratingBefore) &&
                    isValidNumber(adjustment.ratingAfter),
            )
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        const first = history.at(0);
        const last = history.at(-1);

        if (!first || !last) return null;

        let peak = first.ratingBefore;
        let largestGain = 0;
        let largestLoss = 0;

        for (const adjustment of history) {
            peak = Math.max(peak, adjustment.ratingBefore, adjustment.ratingAfter);
            largestGain = Math.max(largestGain, adjustment.ratingDelta);
            largestLoss = Math.min(largestLoss, adjustment.ratingDelta);
        }

        return {
            current: last.ratingAfter,
            peak,
            change: last.ratingAfter - first.ratingBefore,
            largestGain,
            largestLoss,
            adjustmentCount: history.length,
        };
    }

    public static normalizeModStats(stats: ReadonlyArray<OtrPlayerModStatsDto>): Array<IOtrNormalizedModStats> {
        const grouped = new Map<
            string,
            {
                count: number;
                totalScore: number;
            }
        >();

        for (const stat of stats) {
            const mods =
                ModUtils.fromBits(stat.mods)
                    .filter((mod) => mod.acronym !== "NF")
                    .map((mod) => mod.acronym)
                    .join("") || "NM";

            const existing = grouped.get(mods);

            if (existing) {
                existing.count += stat.count;
                existing.totalScore += stat.averageScore * stat.count;
            } else {
                grouped.set(mods, {
                    count: stat.count,
                    totalScore: stat.averageScore * stat.count,
                });
            }
        }

        return Array.from(grouped, ([mods, stat]) => ({
            mods,
            count: stat.count,
            averageScore: stat.count ? stat.totalScore / stat.count : 0,
        }));
    }

    public static recentRatingTrend(
        adjustments: ReadonlyArray<OtrPlayerRatingAdjustmentDto>,
        limit: number = 5,
    ): IOtrRecentRatingTrend {
        const recent = [...adjustments].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit);
        return {
            change: recent.reduce((sum, adjustment) => sum + adjustment.ratingDelta, 0),
            count: recent.length,
        };
    }

    public static favoriteMod(stats: ReadonlyArray<IOtrNormalizedModStats>): IOtrNormalizedModStats | null {
        return stats.reduce<IOtrNormalizedModStats | null>(
            (favorite, stat) => (!favorite || stat.count > favorite.count ? stat : favorite),
            null,
        );
    }

    public static bestAverageMod(stats: ReadonlyArray<IOtrNormalizedModStats>): IOtrNormalizedModStats | null {
        return stats.reduce<IOtrNormalizedModStats | null>(
            (best, stat) => (!best || stat.averageScore > best.averageScore ? stat : best),
            null,
        );
    }

    public static modUsage(stats: ReadonlyArray<IOtrNormalizedModStats>, stat: IOtrNormalizedModStats): number {
        const total = stats.reduce((sum, entry) => sum + entry.count, 0);
        return total ? (stat.count / total) * 100 : 0;
    }

    public static winRate(wins: number, losses: number): number {
        const total = wins + losses;
        return total ? (wins / total) * 100 : 0;
    }
}
