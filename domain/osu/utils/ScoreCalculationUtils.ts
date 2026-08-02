import { ScoreState, ScoreStateKind } from "@generated/calculator/calculator";
import { GameMode, Score } from "@generated/adapter/types";

export class ScoreCalculationUtils {
    public static passedObjects(score: Score, mode: GameMode): number | undefined {
        if (score.passed) {
            return undefined;
        }

        const statistics = score.statistics;

        switch (mode) {
            case GameMode.Standard:
                return this.sum(statistics.great, statistics.ok, statistics.meh, statistics.miss);
            case GameMode.Taiko:
                return this.sum(statistics.great, statistics.ok, statistics.miss);
            case GameMode.Catch:
                return this.sum(
                    statistics.great,
                    statistics.largeTickHit,
                    statistics.smallTickHit,
                    statistics.smallTickMiss,
                    statistics.miss,
                );
            case GameMode.Mania:
                return this.sum(
                    statistics.perfect,
                    statistics.great,
                    statistics.good,
                    statistics.ok,
                    statistics.meh,
                    statistics.miss,
                );
        }
    }

    public static scoreState(score: Score, mode: GameMode): ScoreState {
        const statistics = score.statistics;
        const isStandard = mode === GameMode.Standard;

        return {
            kind: ScoreStateKind.ACTUAL,

            maxCombo: this.count(score.maxCombo),
            accuracy: score.accuracy,

            count300: this.count(statistics.great),
            count100: this.count(statistics.ok),
            count50: this.count(statistics.meh),
            countMiss: this.count(statistics.miss),
            countGeki: this.count(statistics.perfect),
            countKatu: this.count(statistics.good),

            countSmallTickHits: this.count(statistics.smallTickHit),
            countSmallTickMisses: this.count(statistics.smallTickMiss),
            countLargeTickHits: this.count(statistics.largeTickHit),
            countLargeTickMisses: this.count(statistics.largeTickMiss),
            countSliderTailHits: isStandard ? this.count(statistics.ignoreHit) : undefined,
            countSliderTailMisses: isStandard ? this.count(statistics.ignoreMiss) : undefined,
            countSmallBonus: this.count(statistics.smallBonus),
            countLargeBonus: this.count(statistics.largeBonus),
        };
    }

    private static sum(...values: Array<number | undefined>): number | undefined {
        if (values.some((value) => typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)) {
            return undefined;
        }

        return values.reduce((total, value) => total! + (value ?? 0), 0);
    }

    private static count(value: unknown): number {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            return 0;
        }

        return Math.max(0, Math.trunc(value));
    }
}
