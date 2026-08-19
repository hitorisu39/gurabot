import { HitResultResponse } from "@generated/calculator/calculator";
import { ModUtils, ParsedMod } from "@generated/adapter/mods";
import { GameMode, Grade } from "@generated/adapter/types";

export class ScoreGradeEvaluator {
    public static evaluate(mode: GameMode, statistics: HitResultResponse, mods: Array<ParsedMod>): Grade {
        const silver = ["HD", "FL"].some((acronym) => ModUtils.has(mods, acronym));

        let grade: Grade;

        switch (mode) {
            case GameMode.Standard:
                grade = this.standard(statistics);
                break;
            case GameMode.Catch:
                grade = this.catch(statistics.accuracy);
                break;
            case GameMode.Mania:
                grade = this.mania(statistics);
                break;
            case GameMode.Taiko:
            default:
                grade = this.default(statistics.accuracy);
                break;
        }

        if (silver) {
            if (grade === Grade.SS) {
                return Grade.SSH;
            }

            if (grade === Grade.S) {
                return Grade.SH;
            }
        }

        return grade;
    }

    private static standard(statistics: HitResultResponse): Grade {
        let grade = this.default(statistics.accuracy);

        if ((grade === Grade.SS || grade === Grade.S) && statistics.countMiss > 0) {
            grade = Grade.A;
        }

        return grade;
    }

    private static catch(accuracy: number): Grade {
        if (accuracy === 1) {
            return Grade.SS;
        }

        return this.fromThresholds(accuracy, [
            [0.98, Grade.S],
            [0.94, Grade.A],
            [0.9, Grade.B],
            [0.85, Grade.C],
        ]);
    }

    private static mania(statistics: HitResultResponse): Grade {
        const grade = this.default(statistics.accuracy);

        if (grade !== Grade.S) {
            return grade;
        }

        const hasImperfect =
            statistics.countKatu > 0 || statistics.count100 > 0 || statistics.count50 > 0 || statistics.countMiss > 0;

        return hasImperfect ? Grade.S : Grade.SS;
    }

    private static default(accuracy: number): Grade {
        if (accuracy === 1) {
            return Grade.SS;
        }

        return this.fromThresholds(accuracy, [
            [0.95, Grade.S],
            [0.9, Grade.A],
            [0.8, Grade.B],
            [0.7, Grade.C],
        ]);
    }

    private static fromThresholds(accuracy: number, thresholds: Array<readonly [number, Grade]>): Grade {
        for (const [threshold, grade] of thresholds) {
            if (accuracy >= threshold) {
                return grade;
            }
        }

        return Grade.D;
    }
}
