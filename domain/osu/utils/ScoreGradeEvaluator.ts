import { HitResultResponse } from "@generated/calculator/calculator";
import { ModUtils, ParsedMod } from "@generated/adapter/mods";
import { GameMode, Grade } from "@generated/adapter/types";

export class ScoreGradeEvaluator {
    public static evaluate(mode: GameMode, statistics: HitResultResponse, mods: Array<ParsedMod>): Grade {
        const hidden = ["HD", "FL", "FI"].some((acronym) => ModUtils.has(mods, acronym));
        const accuracy = statistics.accuracy;

        if (accuracy == 100.0) return hidden ? Grade.SSH : Grade.SS;

        let grade: Grade;

        switch (mode) {
            case GameMode.Standard:
                grade = this.standard(statistics);
                break;

            case GameMode.Catch:
                grade = this.fromThresholds(accuracy, [
                    [0.98, Grade.S],
                    [0.94, Grade.A],
                    [0.9, Grade.B],
                    [0.85, Grade.C],
                ]);
                break;

            case GameMode.Taiko:
            case GameMode.Mania:
            default:
                grade = this.fromThresholds(accuracy, [
                    [0.95, Grade.S],
                    [0.9, Grade.A],
                    [0.8, Grade.B],
                    [0.7, Grade.C],
                ]);
                break;
        }

        if (grade === Grade.S && hidden) return Grade.SH;
        return grade;
    }

    private static standard(statistics: HitResultResponse): Grade {
        const total = statistics.count300 + statistics.count100 + statistics.count50 + statistics.countMiss;

        if (total <= 0) return Grade.SS;

        const ratio300 = statistics.count300 / total;
        const ratio50 = statistics.count50 / total;
        const misses = statistics.countMiss;

        if (ratio300 > 0.9 && ratio50 < 0.01 && misses === 0) return Grade.S;
        if ((ratio300 > 0.8 && misses === 0) || ratio300 > 0.9) return Grade.A;
        if ((ratio300 > 0.7 && misses === 0) || ratio300 > 0.8) return Grade.B;
        if (ratio300 > 0.6) return Grade.C;

        return Grade.D;
    }

    private static fromThresholds(accuracy: number, thresholds: Array<readonly [number, Grade]>): Grade {
        for (const [threshold, grade] of thresholds) {
            if (accuracy >= threshold) return grade;
        }

        return Grade.D;
    }
}
