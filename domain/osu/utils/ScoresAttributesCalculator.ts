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

            const weightedPP = score.weight.pp;
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
}
