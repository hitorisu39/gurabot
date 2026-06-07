import { Import } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { CalculatorAttributesService } from "./CalculatorAttributes.service";
import { CalculatorMapService } from "./CalculatorMap.service";
import { GameMode } from "@generated/adapter/types";
import { ICalculatePerformanceOptions, IDifficultyCalculationResponse, IPerformanceCalculationResponse, TDifficultyAttributes, TPerformanceAttributes } from "@domain/core/Calculator";
import { ScoreWithMaps, PopulatedScore } from "@domain/osu/Score.dto";
import { BeatmapAttributesCalculator } from "@domain/osu/utils/BeatmapAttributesCalculator";
import { ModUtils, ParsedMod } from "@generated/adapter/mods";

export class CalculatorService extends AbstractService {
    @Import() declare private readonly calculatorAttributesService: CalculatorAttributesService;
    @Import() declare private readonly calculatorMapService: CalculatorMapService;

    public async difficulty<M extends GameMode>(
        beatmapID: number,
        mode: M,
        mods: Array<ParsedMod>
    ): Promise<TDifficultyAttributes<M>> {
        await this.calculatorMapService.download(beatmapID);
        return this.calculatorAttributesService.get(beatmapID, mode, mods);
    }

    public async difficultyWithStrains<M extends GameMode>(
        beatmapID: number,
        mode: M,
        mods: Array<ParsedMod>
    ): Promise<IDifficultyCalculationResponse<M>> {
        await this.calculatorMapService.download(beatmapID);
        return this.calculatorAttributesService.getWithStrains(beatmapID, mode, mods);
    }

    public async performance<M extends GameMode>(
        beatmapID: number,
        mode: M,
        options: Omit<ICalculatePerformanceOptions<M>, "mode" | "beatmapPath">,
        mods: Array<ParsedMod>
    ): Promise<IPerformanceCalculationResponse<M>> {
        await this.calculatorMapService.download(beatmapID);

        const precalculatedDifficulty = await this.calculatorAttributesService.get(beatmapID, mode, mods);

        const protoMods = mods.map(m => ({
            acronym: m.acronym,
            settings: m.settings 
                ? Object.fromEntries(Object.entries(m.settings).map(([k, v]) => [k, String(v)]))
                : {}
        }));

        return this.calculator.performance({
            ...options,
            mode,
            beatmapPath: this.calculatorMapService.getPath(beatmapID),
            precalculatedDifficulty,
            mods: protoMods
        });
    }

    public async scores<M extends GameMode>(
        scores: Array<ScoreWithMaps>, 
        mode: M,
        includeFC: boolean = false
    ): Promise<Array<PopulatedScore<M>>> {
        if (!scores.length) return [];

        const uniqueMapIDs = [...new Set(scores.map(s => s.beatmapID))];
        await this.calculatorMapService.downloadMany(uniqueMapIDs);

        const diffRequests = scores.map(s => ({ beatmapID: s.beatmapID, mode, mods: s.mods }));
        const diffMap = await this.calculatorAttributesService.getMany(diffRequests);

        const streamRequests: Array<ICalculatePerformanceOptions<M>> = [];
        const localResults = new Map<number, IPerformanceCalculationResponse<M>>();

        scores.forEach((score, index) => {
            const perfMods = ModUtils.difficultyAffecting(score.mods);
            const hasSettings = perfMods.some((m) => m.settings && Object.keys(m.settings).length > 0);
            const cacheString = hasSettings ? null : (perfMods.length > 0 ? perfMods.map(m => m.acronym).sort().join("") : "NM");
            const diffKey = hasSettings ? `${score.beatmapID}_CUSTOM` : `${score.beatmapID}_${cacheString}`;

            const precalculatedDifficulty = diffMap.get(diffKey);

            const isFC = score.statistics.miss < 1 &&
                (precalculatedDifficulty && score.maxCombo >= (precalculatedDifficulty.maxCombo * 0.995));

            const beatmapAttributes = BeatmapAttributesCalculator.calculate(score.beatmap, score.mods);

            const protoMods = score.mods.map(m => ({
                acronym: m.acronym,
                settings: m.settings ? Object.fromEntries(Object.entries(m.settings).map(([k, v]) => [k, String(v)])) : {}
            }));

            if (score.pp !== undefined && score.pp !== null && precalculatedDifficulty) {
                localResults.set(index * 2, {
                    attributes: { total: score.pp } as TPerformanceAttributes<M>,
                    difficulty: {
                        attributes: precalculatedDifficulty,
                        beatmap: beatmapAttributes
                    },
                });
            } else {
                streamRequests.push({
                    mode,
                    beatmapPath: this.calculatorMapService.getPath(score.beatmapID),
                    precalculatedDifficulty,
                    referenceId: index * 2,
                    mods: protoMods,
                    totalScore: score.totalScore,
                    legacyTotalScore: score.legacyTotalScore,
                    score: {
                        maxCombo: score.maxCombo,
                        accuracy: score.accuracy,
                        count300: score.statistics.great,
                        count100: score.statistics.ok,
                        count50: score.statistics.meh,
                        countMiss: score.statistics.miss,
                        countGeki: score.statistics.perfect,
                        countKatu: score.statistics.good,
                    }
                });
            }

            if (includeFC && precalculatedDifficulty) {
                if (isFC && score.pp !== undefined && score.pp !== null) {
                    localResults.set((index * 2) + 1, localResults.get(index * 2)!);
                } else {
                    streamRequests.push({
                        mode,
                        beatmapPath: this.calculatorMapService.getPath(score.beatmapID),
                        precalculatedDifficulty,
                        referenceId: (index * 2) + 1, 
                        mods: protoMods,
                        score: {
                            countMiss: 0, 
                            count300: (score.statistics.great || 0) + (score.statistics.miss || 0),
                            maxCombo: precalculatedDifficulty.maxCombo
                        }
                    });
                }
            }
        });

        let streamResults: Array<IPerformanceCalculationResponse<M>> = [];
        if (streamRequests.length > 0) {
            streamResults = await this.calculator.performanceStream(streamRequests);
        }

        for (const res of streamResults) {
            if (res.attributes && res.referenceId !== undefined) {
                localResults.set(res.referenceId, res);
            }
        }

        return scores.map((score, index) => ({
            ...score,
            calculated: localResults.get(index * 2)!,
            calculatedFC: includeFC ? localResults.get((index * 2) + 1) : undefined
        }));
    }
}