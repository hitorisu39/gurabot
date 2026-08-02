import { Import } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { CalculatorAttributesService } from "./CalculatorAttributes.service";
import { CalculatorMapService } from "./CalculatorMap.service";
import { GameMode } from "@generated/adapter/types";
import { ICalculatePerformanceOptions, IDifficultyCalculationResponse, IPerformanceCalculationResponse, TDifficultyAttributes, TPerformanceAttributes } from "@domain/core/Calculator";
import { ScoreWithMaps, PopulatedScore } from "@domain/osu/Score.dto";
import { BeatmapAttributesCalculator } from "@domain/osu/utils/BeatmapAttributesCalculator";
import { ModUtils, ParsedMod } from "@generated/adapter/mods";
import { ScoreCalculationUtils } from "@domain/osu/utils/ScoreCalculationUtils";
import { ScoreStateKind } from "@generated/calculator/calculator";

export class CalculatorService extends AbstractService {
    @Import() declare private readonly calculatorAttributesService: CalculatorAttributesService;
    @Import() declare private readonly calculatorMapService: CalculatorMapService;

    public async difficulty<M extends GameMode>(
        beatmapID: number,
        mode: M,
        mods: Array<ParsedMod>,
        clockRate?: number,
    ): Promise<TDifficultyAttributes<M>> {
        await this.calculatorMapService.download(beatmapID);
        return this.calculatorAttributesService.get(beatmapID, mode, mods, clockRate);
    }

    public async difficultyWithStrains<M extends GameMode>(
        beatmapID: number,
        mode: M,
        mods: Array<ParsedMod>,
        clockRate?: number,
    ): Promise<IDifficultyCalculationResponse<M>> {
        await this.calculatorMapService.download(beatmapID);
        return this.calculatorAttributesService.getWithStrains(beatmapID, mode, mods, clockRate);
    }

    public async performance<M extends GameMode>(
        beatmapID: number,
        mode: M,
        options: Omit<ICalculatePerformanceOptions<M>, "mode" | "beatmapPath">,
        mods: Array<ParsedMod>
    ): Promise<IPerformanceCalculationResponse<M>> {
        await this.calculatorMapService.download(beatmapID);

        const precalculatedDifficulty = options.precalculatedDifficulty ?? await this.calculatorAttributesService.get(beatmapID, mode, mods, options.clockRate);

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
        includeFC: boolean = false,
    ): Promise<Array<PopulatedScore<M>>> {
        if (!scores.length) {
            return [];
        }

        const uniqueMapIDs = [
            ...new Set(scores.map((score) => score.beatmapID)),
        ];

        await this.calculatorMapService.downloadMany(uniqueMapIDs);

        const diffRequests = scores.map((score) => ({
            beatmapID: score.beatmapID,
            mode,
            mods: score.mods,
        }));

        const diffMap =
            await this.calculatorAttributesService.getMany(diffRequests);

        const streamRequests: Array<ICalculatePerformanceOptions<M>> = [];
        const localResults = new Map<
            number,
            IPerformanceCalculationResponse<M>
        >();

        scores.forEach((score, index) => {
            const diffKey = this.calculatorAttributesService.key(
                score.beatmapID,
                mode,
                score.mods,
            );

            const fullDifficulty = diffMap.get(diffKey);

            if (!fullDifficulty) {
                throw new Error(
                    `Missing difficulty attributes for ${diffKey}`,
                );
            }

            const passedObjects =
                ScoreCalculationUtils.passedObjects(score, mode);

            const isPartial = passedObjects !== undefined;

            const isFC =
                score.statistics.miss < 1 &&
                score.maxCombo >= fullDifficulty.maxCombo * 0.995;

            const beatmapAttributes =
                BeatmapAttributesCalculator.calculate(
                    score.beatmap,
                    score.mods,
                );

            const protoMods = score.mods.map((mod) => ({
                acronym: mod.acronym,
                settings: mod.settings
                    ? Object.fromEntries(
                        Object.entries(mod.settings).map(
                            ([setting, value]) => [
                                setting,
                                String(value),
                            ],
                        ),
                    )
                    : {},
            }));

            const actualReferenceID = index * 2;
            const fcReferenceID = actualReferenceID + 1;

            if (score.pp !== undefined && score.pp !== null) {
                localResults.set(actualReferenceID, {
                    attributes: {
                        total: score.pp,
                    } as TPerformanceAttributes<M>,

                    difficulty: {
                        attributes: fullDifficulty,
                        beatmap: beatmapAttributes,
                    },
                });
            } else if (passedObjects === 0) {
                localResults.set(actualReferenceID, {
                    attributes: {
                        total: 0,
                    } as TPerformanceAttributes<M>,

                    difficulty: {
                        attributes: fullDifficulty,
                        beatmap: beatmapAttributes,
                    },
                });
            } else {
                streamRequests.push({
                    mode,
                    beatmapPath: this.calculatorMapService.getPath(
                        score.beatmapID,
                    ),

                    precalculatedDifficulty: isPartial
                        ? undefined
                        : fullDifficulty,

                    passedObjects,
                    referenceId: actualReferenceID,
                    mods: protoMods,

                    totalScore: score.totalScore,
                    legacyTotalScore: score.legacyTotalScore,

                    score: ScoreCalculationUtils.actualScoreState(
                        score,
                        mode,
                    ),
                });
            }

            if (!includeFC) {
                return;
            }

            if (
                isFC &&
                score.pp !== undefined &&
                score.pp !== null &&
                localResults.has(actualReferenceID)
            ) {
                localResults.set(
                    fcReferenceID,
                    localResults.get(actualReferenceID)!,
                );

                return;
            }

            streamRequests.push({
                mode,
                beatmapPath: this.calculatorMapService.getPath(
                    score.beatmapID,
                ),
                precalculatedDifficulty: fullDifficulty,
                referenceId: fcReferenceID,
                mods: protoMods,

                score: {
                    kind: ScoreStateKind.SIMULATION,
                    countMiss: 0,
                    count300:
                        (score.statistics.great || 0) +
                        (score.statistics.miss || 0),

                    maxCombo: fullDifficulty.maxCombo,
                },
            });
        });

        if (streamRequests.length > 0) {
            const streamResults =
                await this.calculator.performanceStream(streamRequests);

            for (const result of streamResults) {
                if (
                    result.attributes &&
                    result.referenceId !== undefined
                ) {
                    localResults.set(result.referenceId, result);
                }
            }
        }

        return scores.map((score, index) => {
            const calculated = localResults.get(index * 2);

            if (!calculated) {
                throw new Error(
                    `Missing performance result for score index ${index}`,
                );
            }

            return {
                ...score,
                calculated,
                calculatedFC: includeFC
                    ? localResults.get(index * 2 + 1)
                    : undefined,
            };
        });
    }
}