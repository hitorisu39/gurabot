// ScoreCalculationUtils.ts
import { GameMode } from "@generated/adapter/types";
import { PerformanceRequest, ScoreStateKind } from "@generated/calculator/calculator";
import { ScoreWithMaps } from "@domain/osu/Score.dto";

export class ScoreCalculationUtils {
    public static passedObjects(score: ScoreWithMaps, mode: GameMode): number | undefined {
        if (score.passed) {
            return undefined;
        }

        if (mode !== GameMode.Standard || score.beatmap.mode !== GameMode.Standard || score.beatmap.convert) {
            return undefined;
        }

        const values = [score.statistics.great, score.statistics.ok, score.statistics.meh, score.statistics.miss];

        if (!values.every((value) => Number.isFinite(value) && value >= 0)) {
            return undefined;
        }

        const passedObjects = values.reduce((sum, value) => sum + Math.trunc(value), 0);

        const mapObjectCount = score.beatmap.countCircles + score.beatmap.countSliders + score.beatmap.countSpinners;

        if (passedObjects > mapObjectCount) {
            return undefined;
        }

        return passedObjects;
    }

    public static actualScoreState(score: ScoreWithMaps, mode: GameMode): PerformanceRequest["score"] {
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

            countIgnoreHit: isStandard ? undefined : this.count(statistics.ignoreHit),

            countIgnoreMiss: this.count(statistics.ignoreMiss),

            countSmallBonus: this.count(statistics.smallBonus),
            countLargeBonus: this.count(statistics.largeBonus),
        };
    }

    private static count(value: unknown): number {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            return 0;
        }

        return Math.max(0, Math.trunc(value));
    }
}
