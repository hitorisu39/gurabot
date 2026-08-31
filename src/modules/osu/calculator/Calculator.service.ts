import { Import } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { CalculatorAttributesService } from "./CalculatorAttributes.service";
import { CalculatorMapService } from "./CalculatorMap.service";
import { GameMode } from "@generated/adapter/types";
import { ParsedMod } from "@generated/adapter/mods";
import { ScoreState, ScoreStateKind } from "@generated/calculator/calculator";
import {
    ICalculatePerformanceOptions,
    IDifficultyCalculationResponse,
    IPerformanceCalculationResponse,
    TDifficultyAttributes,
    TPerformanceAttributes,
    toCalculatorMods,
} from "@domain/core/Calculator";

import { PopulatedScore, ScoreWithMaps } from "@domain/osu/Score.dto";
import { ScoreCalculationUtils } from "@domain/osu/utils/ScoreCalculationUtils";
import { EApplicationError, Exception } from "@domain/core/Exception";

type TDifficultyMap<M extends GameMode> = Map<string, IDifficultyCalculationResponse<M>>;
type TPerformanceResultMap<M extends GameMode> = Map<number, IPerformanceCalculationResponse<M>>;

export class CalculatorService extends AbstractService {
    @Import() declare private readonly calculatorAttributesService: CalculatorAttributesService;
    @Import() declare private readonly calculatorMapService: CalculatorMapService;

    //#region API

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
        strainPointLimit?: number,
    ): Promise<IDifficultyCalculationResponse<M>> {
        await this.calculatorMapService.download(beatmapID);
        return this.calculatorAttributesService.getWithStrains(beatmapID, mode, mods, clockRate, strainPointLimit);
    }

    public async performance<M extends GameMode>(
        beatmapID: number,
        mode: M,
        options: Omit<ICalculatePerformanceOptions<M>, "mode" | "beatmapPath">,
        mods: Array<ParsedMod>,
    ): Promise<IPerformanceCalculationResponse<M>> {
        await this.calculatorMapService.download(beatmapID);

        const precalculatedDifficulty =
            options.precalculatedDifficulty ??
            (await this.calculatorAttributesService.get(beatmapID, mode, mods, options.clockRate));

        return this.calculator.performance({
            ...options,
            mode,
            beatmapPath: this.calculatorMapService.getPath(beatmapID),
            precalculatedDifficulty,
            mods: toCalculatorMods(mods),
        });
    }

    public async scores<M extends GameMode>(
        scores: Array<ScoreWithMaps>,
        mode: M,
        includeFC = false,
    ): Promise<Array<PopulatedScore<M>>> {
        if (!scores.length) {
            return [];
        }

        await this.downloadScoreMaps(scores);

        const difficulties = await this.getScoreDifficulties(scores, mode);

        const requests: Array<ICalculatePerformanceOptions<M>> = [];
        const results: TPerformanceResultMap<M> = new Map();

        for (const [index, score] of scores.entries()) {
            const difficulty = this.getScoreDifficulty(difficulties, score, mode);

            const actualReferenceID = index * 2;
            const fcReferenceID = actualReferenceID + 1;

            this.prepareActualScore(score, mode, difficulty, actualReferenceID, requests, results);

            if (includeFC)
                this.prepareFCScore(score, mode, difficulty, actualReferenceID, fcReferenceID, requests, results);
        }

        await this.resolvePerformanceRequests(requests, results);

        return scores.map((score, index) => {
            const actualReferenceID = index * 2;
            const calculated = results.get(actualReferenceID);

            if (!calculated) {
                throw new Exception(
                    EApplicationError.INTERNAL_ERROR,
                    `Missing performance result for score index ${index}`,
                );
            }

            const difficulty = this.getScoreDifficulty(difficulties, score, mode);

            return {
                ...score,
                fullDifficulty: difficulty.attributes,
                calculated,
                calculatedFC: includeFC ? results.get(actualReferenceID + 1) : undefined,
            };
        });
    }

    //#endregion

    //#region Scores

    private async downloadScoreMaps(scores: ReadonlyArray<ScoreWithMaps>): Promise<void> {
        const beatmapIDs = [...new Set(scores.map((score) => score.beatmapID))];
        await this.calculatorMapService.downloadMany(beatmapIDs);
    }

    private async getScoreDifficulties<M extends GameMode>(
        scores: ReadonlyArray<ScoreWithMaps>,
        mode: M,
    ): Promise<TDifficultyMap<M>> {
        return this.calculatorAttributesService.getManyFull(
            scores.map((score) => ({
                beatmapID: score.beatmapID,
                mode,
                mods: score.mods,
            })),
        );
    }

    private getScoreDifficulty<M extends GameMode>(
        difficulties: TDifficultyMap<M>,
        score: ScoreWithMaps,
        mode: M,
    ): IDifficultyCalculationResponse<M> {
        const key = this.calculatorAttributesService.key(score.beatmapID, mode, score.mods);
        const difficulty = difficulties.get(key);
        if (!difficulty) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `Missing difficulty attributes for ${key}`);
        }

        return difficulty;
    }

    private prepareActualScore<M extends GameMode>(
        score: ScoreWithMaps,
        mode: M,
        difficulty: IDifficultyCalculationResponse<M>,
        referenceID: number,
        requests: Array<ICalculatePerformanceOptions<M>>,
        results: TPerformanceResultMap<M>,
    ): void {
        if (score.pp != null) {
            results.set(referenceID, {
                attributes: {
                    total: score.pp,
                } as TPerformanceAttributes<M>,
                difficulty,
            });

            return;
        }

        const passedObjects = ScoreCalculationUtils.passedObjects(score, mode);

        if (passedObjects === 0) {
            results.set(referenceID, {
                attributes: {
                    total: 0,
                } as TPerformanceAttributes<M>,
                difficulty,
            });

            return;
        }

        requests.push({
            mode,
            beatmapPath: this.calculatorMapService.getPath(score.beatmapID),
            precalculatedDifficulty: passedObjects === undefined ? difficulty.attributes : undefined,
            passedObjects,
            referenceId: referenceID,
            mods: toCalculatorMods(score.mods),
            totalScore: score.totalScore,
            legacyTotalScore: score.legacyTotalScore,
            score: ScoreCalculationUtils.scoreState(score, mode),
        });
    }

    private prepareFCScore<M extends GameMode>(
        score: ScoreWithMaps,
        mode: M,
        difficulty: IDifficultyCalculationResponse<M>,
        actualReferenceID: number,
        fcReferenceID: number,
        requests: Array<ICalculatePerformanceOptions<M>>,
        results: TPerformanceResultMap<M>,
    ): void {
        const isFC = score.statistics.miss < 1 && score.maxCombo >= difficulty.attributes.maxCombo * 0.995;

        if (isFC && score.pp != null && results.has(actualReferenceID)) {
            results.set(fcReferenceID, results.get(actualReferenceID)!);
            return;
        }

        const scoreState = ScoreCalculationUtils.scoreState(score, mode);

        requests.push({
            mode,
            beatmapPath: this.calculatorMapService.getPath(score.beatmapID),
            precalculatedDifficulty: difficulty.attributes,
            referenceId: fcReferenceID,
            mods: toCalculatorMods(score.mods),
            score: this.createFCScoreState(scoreState, mode, difficulty.attributes.maxCombo),
        });
    }

    private createFCScoreState(scoreState: ScoreState, mode: GameMode, maxCombo: number): ScoreState {
        if (mode === GameMode.Catch) {
            return {
                ...scoreState,
                kind: ScoreStateKind.SIMULATION,
                count300: undefined,
                count100: undefined,
                count50: undefined,
                countKatu: undefined,
                countLargeTickHits: undefined,
                countSmallTickHits: scoreState.countSmallTickHits,
                countSmallTickMisses: scoreState.countSmallTickMisses,
                countMiss: 0,
                maxCombo,
            };
        }

        const misses = Math.max(0, scoreState.countMiss ?? 0);

        return {
            ...scoreState,
            kind: ScoreStateKind.SIMULATION,
            count300: (scoreState.count300 ?? 0) + misses,
            countMiss: 0,
            maxCombo,
        };
    }

    private async resolvePerformanceRequests<M extends GameMode>(
        requests: Array<ICalculatePerformanceOptions<M>>,
        results: TPerformanceResultMap<M>,
    ): Promise<void> {
        if (!requests.length) {
            return;
        }

        const responses = await this.calculator.performanceStream(requests);
        for (const response of responses) {
            if (!response.attributes || response.referenceId === undefined) {
                continue;
            }

            results.set(response.referenceId, response);
        }
    }

    //#endregion
}
