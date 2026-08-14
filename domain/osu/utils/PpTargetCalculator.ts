import { Score } from "@generated/adapter/types";
import { ScoreUtils } from "./ScoreUtils";
import { PpTargetCalculationDto, PpTargetRouteDto } from "../Reach.dto";
import { EPpTargetCalculationType } from "../enums/Reach.enum";

export class PpTargetCalculator {
    private static readonly ppPrecision = 100;
    private static readonly maxPlayPP = 99999;

    constructor(
        private readonly scores: ReadonlyArray<Score>,
        private readonly currentPP: number,
        private readonly limit: number = 100,
    ) {}

    public calculateForPlays(targetPP: number, plays: number): PpTargetCalculationDto | null {
        const each = this.requiredEqualPP(targetPP, plays);

        if (each === null) {
            return null;
        }

        return {
            type: EPpTargetCalculationType.Plays,
            primary: this.route(Array(plays).fill(each)),
        };
    }

    public calculateForEach(targetPP: number, each: number): PpTargetCalculationDto | null {
        for (let plays = 1; plays <= this.limit; plays++) {
            const scores = Array(plays).fill(each);
            const route = this.route(scores);

            if (route.projectedPP >= targetPP) {
                return {
                    type: EPpTargetCalculationType.Each,
                    primary: route,
                };
            }
        }

        return null;
    }

    public calculateAuto(targetPP: number): PpTargetCalculationDto | null {
        const singlePP = this.requiredEqualPP(targetPP, 1);

        if (singlePP === null) {
            return null;
        }

        const primary = this.route([singlePP]);
        const topPlayPP = this.topPlayPP();

        if (topPlayPP === null || singlePP <= topPlayPP) {
            return {
                type: EPpTargetCalculationType.Auto,
                primary,
            };
        }

        for (let plays = 2; plays <= this.limit; plays++) {
            const requiredEach = this.requiredEqualPP(targetPP, plays);

            if (requiredEach === null || requiredEach > topPlayPP) {
                continue;
            }

            const repeatedPP = Math.ceil(requiredEach);

            if (plays === 2) {
                const finalPP = this.requiredFinalPP(targetPP, [repeatedPP], repeatedPP);

                return {
                    type: EPpTargetCalculationType.Auto,
                    primary,
                    alternative: this.route([repeatedPP, finalPP ?? repeatedPP]),
                };
            }

            const repeatedScores = Array(plays - 1).fill(repeatedPP);
            const finalPP = this.requiredFinalPP(targetPP, repeatedScores, repeatedPP);

            return {
                type: EPpTargetCalculationType.Auto,
                primary,
                alternative: this.route([...repeatedScores, finalPP ?? repeatedPP]),
            };
        }

        return {
            type: EPpTargetCalculationType.Auto,
            primary,
            alternativeUnavailable: true,
        };
    }

    private requiredEqualPP(targetPP: number, plays: number): number | null {
        return this.binarySearchPP(
            (pp) => this.route(Array(plays).fill(pp)).projectedPP >= targetPP,
            PpTargetCalculator.maxPlayPP,
        );
    }

    private requiredFinalPP(
        targetPP: number,
        existingHypotheticalScores: ReadonlyArray<number>,
        ceiling: number,
    ): number | null {
        return this.binarySearchPP(
            (pp) => this.route([...existingHypotheticalScores, pp]).projectedPP >= targetPP,
            ceiling,
        );
    }

    private binarySearchPP(predicate: (pp: number) => boolean, ceiling: number): number | null {
        const scale = PpTargetCalculator.ppPrecision;

        let low = 0;
        let high = Math.ceil(ceiling * scale);

        if (!predicate(high / scale)) {
            return null;
        }

        while (low < high) {
            const mid = Math.floor((low + high) / 2);
            const value = mid / scale;

            if (predicate(value)) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }

        return low / scale;
    }

    private route(hypotheticalScores: ReadonlyArray<number>): PpTargetRouteDto {
        const simulation = ScoreUtils.simulatePP(this.scores, hypotheticalScores, this.limit);
        const projectedPP = this.currentPP + simulation.weightedDifference;

        return {
            scores: [...hypotheticalScores],
            projectedPP,
            ppDifference: projectedPP - this.currentPP,
        };
    }

    private topPlayPP(): number | null {
        let highest: number | null = null;

        for (const score of this.scores) {
            const pp = ScoreUtils.pp(score);

            if (pp === undefined || !Number.isFinite(pp)) {
                continue;
            }

            if (highest === null || pp > highest) {
                highest = pp;
            }
        }

        return highest;
    }
}
