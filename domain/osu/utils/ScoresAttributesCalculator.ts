import { Score } from "@generated/adapter/types";
import {
    PopulatedScore,
    PopulatedScoreAverageDto,
    PopulatedScoreAverageFieldDto,
    ScoreModStatistics,
} from "../Score.dto";
import { BeatmapAttributesCalculator } from "./BeatmapAttributesCalculator";

export class ScoresAttributesCalculator {
    public static average(scores: Array<PopulatedScore>): PopulatedScoreAverageDto {
        const getStats = (values: Array<number>): PopulatedScoreAverageFieldDto => {
            const field = new PopulatedScoreAverageFieldDto();
            if (!values || values.length === 0) {
                field.min = 0;
                field.avg = 0;
                field.max = 0;
                return field;
            }

            let min = values[0]!;
            let max = values[0]!;
            let sum = 0;

            for (const v of values) {
                if (v < min) min = v;
                if (v > max) max = v;
                sum += v;
            }

            field.min = min;
            field.max = max;
            field.avg = sum / values.length;

            return field;
        };

        const ppValues: Array<number> = [];
        const comboValues: Array<number> = [];
        const lengthValues: Array<number> = [];
        const accuracyValues: Array<number> = [];
        const bpmValues: Array<number> = [];
        const arValues: Array<number> = [];
        const odValues: Array<number> = [];
        const csValues: Array<number> = [];
        const hpValues: Array<number> = [];
        const missValues: Array<number> = [];
        const starsValues: Array<number> = [];

        for (const score of scores || []) {
            ppValues.push(score.calculated?.attributes?.total ?? score.pp);
            comboValues.push(score.maxCombo);
            accuracyValues.push(score.accuracy * 100);
            starsValues.push(score.fullDifficulty.starRating);

            const beatmapAttributes = score.calculated?.difficulty?.beatmap;
            const beatmap = score.beatmap;
            const clockRate = beatmapAttributes.clockRate;

            bpmValues.push(BeatmapAttributesCalculator.bpm(beatmap.bpm, clockRate));
            lengthValues.push(BeatmapAttributesCalculator.length(beatmap.totalLength, clockRate));

            arValues.push(beatmapAttributes.ar);
            odValues.push(beatmapAttributes.od);
            csValues.push(beatmapAttributes.cs);
            hpValues.push(beatmapAttributes.hp);

            const stats = score.statistics;
            missValues.push(stats.miss);
        }

        const dto = new PopulatedScoreAverageDto();

        dto.pp = getStats(ppValues);
        dto.combo = getStats(comboValues);
        dto.length = getStats(lengthValues);
        dto.accuracy = getStats(accuracyValues);
        dto.bpm = getStats(bpmValues);
        dto.ar = getStats(arValues);
        dto.od = getStats(odValues);
        dto.cs = getStats(csValues);
        dto.hp = getStats(hpValues);
        dto.miss = getStats(missValues);
        dto.stars = getStats(starsValues);

        return dto;
    }

    public static modStatistics(scores: Array<Score>): ScoreModStatistics {
        if (!scores || scores.length === 0) {
            return {
                individualMods: [],
                modCombos: [],
                ppByCombo: [],
            };
        }

        const totalScores = scores.length;
        const individualModCounts = new Map<string, number>();
        const comboCounts = new Map<string, number>();
        const comboPp = new Map<string, number>();

        for (const score of scores) {
            const acronyms = score.mods.map((m) => m.acronym).sort();
            const comboKey = acronyms.length > 0 ? acronyms.join("") : "NM";

            comboCounts.set(comboKey, (comboCounts.get(comboKey) || 0) + 1);

            const weightedPP = score.weight?.pp || 0;
            comboPp.set(comboKey, (comboPp.get(comboKey) || 0) + weightedPP);

            for (const acronym of acronyms) {
                individualModCounts.set(acronym, (individualModCounts.get(acronym) || 0) + 1);
            }
        }

        const individualMods = [...individualModCounts.entries()]
            .map(([acronym, count]) => ({
                acronym,
                count,
                percentage: (count / totalScores) * 100,
            }))
            .sort((a, b) => b.count - a.count);

        const modCombos = [...comboCounts.entries()]
            .map(([combo, count]) => ({
                combo,
                count,
                percentage: (count / totalScores) * 100,
            }))
            .sort((a, b) => b.count - a.count);

        const ppByCombo = [...comboPp.entries()]
            .map(([combo, totalWeightedPP]) => ({
                combo,
                totalWeightedPP,
            }))
            .sort((a, b) => b.totalWeightedPP - a.totalWeightedPP);

        return { individualMods, modCombos, ppByCombo };
    }

    public static ppValues(scores: ReadonlyArray<Score>): Array<number> {
        return scores
            .map((score) => score.pp)
            .filter((pp): pp is number => typeof pp === "number" && Number.isFinite(pp));
    }

    public static averagePP(scores: ReadonlyArray<Score>): number | null {
        const values = this.ppValues(scores);

        if (!values.length) {
            return null;
        }

        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    public static medianPP(scores: ReadonlyArray<Score>): number | null {
        const values = this.ppValues(scores).sort((a, b) => a - b);

        if (!values.length) {
            return null;
        }

        const middle = Math.floor(values.length / 2);

        if (values.length % 2 === 0) {
            return (values[middle - 1]! + values[middle]!) / 2;
        }

        return values[middle]!;
    }

    public static ppAt(scores: ReadonlyArray<Score>, index: number): number | null {
        const pp = scores[index]?.pp;
        return typeof pp === "number" && Number.isFinite(pp) ? pp : null;
    }

    /**
     * Difference between the first score and a specific lower placement.
     *
     * E.g. endIndex = 99 gives the top #1 -> top #100 spread.
     */
    public static ppSpread(scores: ReadonlyArray<Score>, endIndex: number = scores.length - 1): number | null {
        const first = this.ppAt(scores, 0);
        const last = this.ppAt(scores, endIndex);

        if (first === null || last === null) {
            return null;
        }

        return first - last;
    }

    public static weightedPP(scores: ReadonlyArray<Score>): number {
        return scores.reduce((sum, score) => sum + (score.weight?.pp ?? 0), 0);
    }

    public static averageAccuracy(scores: ReadonlyArray<Score>): number | null {
        if (!scores.length) {
            return null;
        }

        return (scores.reduce((sum, score) => sum + score.accuracy, 0) / scores.length) * 100;
    }

    public static averageCombo(scores: ReadonlyArray<Score>): number | null {
        if (!scores.length) {
            return null;
        }

        return scores.reduce((sum, score) => sum + score.maxCombo, 0) / scores.length;
    }

    public static averageMisses(scores: ReadonlyArray<Score>): number | null {
        if (!scores.length) {
            return null;
        }

        return scores.reduce((sum, score) => sum + score.statistics.miss, 0) / scores.length;
    }

    public static noMissPercentage(scores: ReadonlyArray<Score>): number | null {
        if (!scores.length) {
            return null;
        }

        const noMiss = scores.filter((score) => score.statistics.miss === 0).length;
        return (noMiss / scores.length) * 100;
    }
}
