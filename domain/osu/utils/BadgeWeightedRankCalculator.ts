export class BadgeWeightedRankCalculator {
    private static readonly badgeWeight = 0.9937;

    public static calculate(rank: number, badgeCount: number): number {
        if (rank <= 0) return 0;
        return Math.round(Math.pow(rank, Math.pow(this.badgeWeight, Math.pow(badgeCount, 2))));
    }

    public static adjustment(rank: number, bws: number): number {
        if (rank <= 0) return 0;
        return ((rank - bws) / rank) * 100;
    }
}
