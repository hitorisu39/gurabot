import { Score } from "@generated/adapter/types";
import { PopulatedScore, ScoreWithMaps } from "../Score.dto";
import { BeatmapUtils } from "./BeatmapUtils";

export interface IScorePPProjection {
    /**
     * One-based position of the hypothetical score.
     * Null means it would not enter the retained top scores.
     */
    placement: number | null;

    currentWeightedPP: number;
    projectedWeightedPP: number;
    weightedDifference: number;
}

export interface IScorePPSimulation {
    /**
     * One-based positions of hypothetical scores.
     * Null means the score did not enter the retained top scores.
     */
    placements: Array<number | null>;

    currentWeightedPP: number;
    projectedWeightedPP: number;
    weightedDifference: number;
}

interface IWeightedPPEntry {
    pp: number;
    hypotheticalIndex: number | null;
}

export class ScoreUtils {
    private static readonly ppWeightDecay = 0.95;

    public static hasMaps(score: Score): score is ScoreWithMaps {
        return score.beatmap !== undefined && score.beatmapset !== undefined;
    }

    public static isPopulated(score: Score): score is PopulatedScore {
        return !!(score as Partial<PopulatedScore>).calculated;
    }

    public static isFullyPopulated(score: Score): score is PopulatedScore {
        return this.hasMaps(score) && this.isPopulated(score);
    }

    public static pp(score: Score): number | undefined {
        if (typeof score.pp === "number") {
            return score.pp;
        }

        if (this.isPopulated(score)) {
            return score.calculated.attributes.total;
        }

        return undefined;
    }

    public static isFC(score: Score): boolean {
        if (!ScoreUtils.isPopulated(score)) return score.statistics.miss < 1;
        return score.statistics.miss < 1 && score.maxCombo >= score.fullDifficulty.maxCombo * 0.995;
    }

    public static isRanked(score: ScoreWithMaps): boolean {
        return !!score.ranked && BeatmapUtils.awardsPerformancePoints(score.beatmap.status);
    }

    public static weightedPP(scores: ReadonlyArray<Score>): number {
        return this.weightedPPValues(
            scores.map((score) => this.pp(score)).filter((pp): pp is number => typeof pp === "number"),
        );
    }

    public static weightedPPValues(values: ReadonlyArray<number>): number {
        return [...values]
            .filter((pp) => Number.isFinite(pp) && pp >= 0)
            .sort((a, b) => b - a)
            .reduce((total, pp, index) => total + pp * Math.pow(this.ppWeightDecay, index), 0);
    }

    public static simulatePP(
        scores: ReadonlyArray<Score>,
        hypotheticalPP: ReadonlyArray<number>,
        limit: number = 100,
    ): IScorePPSimulation {
        const currentEntries: Array<IWeightedPPEntry> = scores
            .map((score) => this.pp(score))
            .filter((pp): pp is number => typeof pp === "number" && Number.isFinite(pp) && pp >= 0)
            .sort((a, b) => b - a)
            .slice(0, limit)
            .map((pp) => ({
                pp,
                hypotheticalIndex: null,
            }));

        const hypotheticalEntries: Array<IWeightedPPEntry> = hypotheticalPP
            .map((pp, hypotheticalIndex) => ({
                pp,
                hypotheticalIndex,
            }))
            .filter((entry) => Number.isFinite(entry.pp) && entry.pp >= 0);

        const currentWeightedPP = this.weightedPPValues(currentEntries.map((entry) => entry.pp));
        const retainedCount = Math.min(limit, currentEntries.length + hypotheticalEntries.length);

        const projectedEntries = [...currentEntries, ...hypotheticalEntries]
            .sort((a, b) => {
                const difference = b.pp - a.pp;

                if (difference !== 0) {
                    return difference;
                }

                if (a.hypotheticalIndex !== null && b.hypotheticalIndex === null) {
                    return -1;
                }

                if (a.hypotheticalIndex === null && b.hypotheticalIndex !== null) {
                    return 1;
                }

                if (a.hypotheticalIndex !== null && b.hypotheticalIndex !== null) {
                    return a.hypotheticalIndex - b.hypotheticalIndex;
                }

                return 0;
            })
            .slice(0, retainedCount);

        const placements: Array<number | null> = hypotheticalPP.map(() => null);

        for (let index = 0; index < projectedEntries.length; index++) {
            const entry = projectedEntries[index];
            if (entry && entry.hypotheticalIndex !== null) {
                placements[entry.hypotheticalIndex] = index + 1;
            }
        }

        const projectedWeightedPP = this.weightedPPValues(projectedEntries.map((entry) => entry.pp));

        return {
            placements,
            currentWeightedPP,
            projectedWeightedPP,
            weightedDifference: projectedWeightedPP - currentWeightedPP,
        };
    }

    public static projectPP(
        scores: ReadonlyArray<Score>,
        hypotheticalPP: number,
        limit: number = 100,
    ): IScorePPProjection {
        const simulation = this.simulatePP(scores, [hypotheticalPP], limit);

        return {
            placement: simulation.placements[0] ?? null,
            currentWeightedPP: simulation.currentWeightedPP,
            projectedWeightedPP: simulation.projectedWeightedPP,
            weightedDifference: simulation.weightedDifference,
        };
    }

    public static compare(a: Score, b: Score): boolean {
        const aIDs = this.identifiers(a);
        const bIDs = this.identifiers(b);

        if (aIDs.some((id) => bIDs.includes(id))) {
            return true;
        }

        return (
            a.userID === b.userID &&
            a.beatmapID === b.beatmapID &&
            a.endedAt.getTime() === b.endedAt.getTime() &&
            (a.legacyTotalScore ?? a.totalScore) === (b.legacyTotalScore ?? b.totalScore) &&
            a.maxCombo === b.maxCombo &&
            this.modsKey(a) === this.modsKey(b)
        );
    }

    private static identifiers(score: Score): Array<number> {
        return [score.id, score.legacyScoreID].filter((id): id is number => typeof id === "number" && id > 0);
    }

    private static modsKey(score: Score): string {
        return score.mods
            .map((mod) => mod.acronym)
            .sort()
            .join("");
    }
}
