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

            maxCombo: this.optionalCount(score.maxCombo),
            accuracy: this.optionalAccuracy(score.accuracy),

            count300: this.optionalCount(statistics.great),
            count100: this.optionalCount(statistics.ok),
            count50: this.optionalCount(statistics.meh),
            countMiss: this.optionalCount(statistics.miss),
            countGeki: this.optionalCount(statistics.perfect),
            countKatu: this.optionalCount(statistics.good),

            countSmallTickHits: this.optionalCount(statistics.smallTickHit),
            countSmallTickMisses: this.optionalCount(statistics.smallTickMiss),
            countLargeTickHits: this.optionalCount(statistics.largeTickHit),
            countLargeTickMisses: this.optionalCount(statistics.largeTickMiss),

            countSliderTailHits: isStandard ? this.optionalCount(statistics.ignoreHit) : undefined,

            countSliderTailMisses: isStandard ? this.optionalCount(statistics.ignoreMiss) : undefined,

            countSmallBonus: this.optionalCount(statistics.smallBonus),
            countLargeBonus: this.optionalCount(statistics.largeBonus),
        };
    }

    private static sum(...values: Array<number | undefined>): number | undefined {
        if (values.some((value) => typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)) {
            return undefined;
        }

        return values.reduce((total, value) => total! + value!, 0);
    }

    private static optionalCount(value: unknown): number | undefined {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            return undefined;
        }

        return Math.max(0, Math.trunc(value));
    }

    private static optionalAccuracy(value: unknown): number | undefined {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            return undefined;
        }

        return Math.max(0, Math.min(1, value));
    }
}
