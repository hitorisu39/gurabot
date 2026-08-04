import { Beatmap, Score } from "@generated/adapter/types";
import { PersonalBestPlacementDto, ScoreWithPlacement } from "../Score.dto";
import { ScoreUtils } from "./ScoreUtils";
import { plainToInstance } from "class-transformer";
import { EPersonalBestCase } from "../enums/Score.enum";
import { BeatmapUtils } from "./BeatmapUtils";

export class ScorePlacementEvaluator {
    constructor(
        private readonly beatmap: Beatmap,
        private readonly personalScores: Array<Score>,
        private readonly globalScores: Array<Score>,
    ) {}

    public evaluate<T extends Score>(scores: Array<T>): Array<T & ScoreWithPlacement> {
        return scores.map((score) => {
            const personalBest = this.personalBest(score);
            const globalTop = this.globalTop(score);

            return this.withPlacements(score, personalBest, globalTop);
        });
    }

    private personalBest(score: Score): PersonalBestPlacementDto | undefined {
        const confirmedIndex = this.indexOf(score, this.personalScores);

        if (confirmedIndex !== undefined) {
            return this.createPersonalBest(EPersonalBestCase.ScorePresent, confirmedIndex);
        }

        const pp = ScoreUtils.pp(score);
        if (pp === undefined) {
            return undefined;
        }

        const existingScores = this.personalScores.filter(
            (personalScore) => personalScore.beatmapID === score.beatmapID && !ScoreUtils.compare(personalScore, score),
        );

        if (existingScores.length > 0) {
            const existingPPValues = existingScores.map((existingScore) => ScoreUtils.pp(existingScore));

            if (existingPPValues.some((existingPP) => existingPP === undefined)) {
                return undefined;
            }

            const betterScoreExists = existingPPValues.some(
                (existingPP) => existingPP !== undefined && existingPP > pp,
            );

            if (betterScoreExists) {
                return this.createPersonalBest(
                    EPersonalBestCase.ScoreWorse,
                    this.insertionIndex(this.personalScores, pp),
                );
            }
        }

        const rankingPool = this.personalScores.filter((personalScore) => personalScore.beatmapID !== score.beatmapID);

        const assumedIndex = this.insertionIndex(rankingPool, pp);

        if (assumedIndex >= 100) {
            return undefined;
        }

        if (!BeatmapUtils.awardsPerformancePoints(this.beatmap) || score.ranked === false) {
            return this.createPersonalBest(EPersonalBestCase.NotRanked, assumedIndex);
        }

        return this.createPersonalBest(EPersonalBestCase.ScorePresentPresumably, assumedIndex);
    }

    private globalTop(score: Score): number | undefined {
        return this.indexOf(score, this.globalScores);
    }

    private indexOf(target: Score, scores: Array<Score>): number | undefined {
        const arrayIndex = scores.findIndex((score) => ScoreUtils.compare(score, target));

        if (arrayIndex === -1) {
            return undefined;
        }

        const matchedScore = scores[arrayIndex]!;

        if (matchedScore.index > 0) {
            return matchedScore.index - 1;
        }

        return arrayIndex;
    }

    private insertionIndex(scores: Array<Score>, targetPP: number): number {
        const ppValues = scores.map((score) => ScoreUtils.pp(score) ?? Number.POSITIVE_INFINITY).sort((a, b) => b - a);

        const index = ppValues.findIndex((pp) => pp < targetPP);

        return index === -1 ? ppValues.length : index;
    }

    private createPersonalBest(bestCase: EPersonalBestCase, index: number): PersonalBestPlacementDto {
        return plainToInstance(PersonalBestPlacementDto, {
            case: bestCase,
            index,
        });
    }

    private withPlacements<T extends Score>(
        score: T,
        personalBest?: PersonalBestPlacementDto,
        globalTop?: number,
    ): T & ScoreWithPlacement {
        const placedScore = score as T & ScoreWithPlacement;

        if (personalBest !== undefined) {
            placedScore.personalBest = personalBest;
        }

        if (globalTop !== undefined) {
            placedScore.globalTop = globalTop;
        }

        return placedScore;
    }
}
