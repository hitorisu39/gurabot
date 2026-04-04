import { Score } from "@generated/adapter/types";
import { PopulatedScore, PopulatedScoresQueryDto } from "../Score.dto";
import { ScoreWithMapsEvaluator } from "./ScoreWithMapsEvaluator";
import { EScoreQuerySort } from "../enums/Score.enum";
import { rangeContains } from "@domain/utils";

export class PopulatedScoreEvaluator<
    Q extends PopulatedScoresQueryDto = PopulatedScoresQueryDto,
> extends ScoreWithMapsEvaluator<Q> {
    public get populated(): boolean {
        if (!this.query) return super.populated;
        return (
            super.populated ||
            this.query.stars.some() ||
            this.query.ppfc.some() ||
            this.sortType === EScoreQuerySort.Stars ||
            this.sortType === EScoreQuerySort.PPFC
        );
    }

    private isPopulated(score: Score): score is PopulatedScore {
        return "calculated" in score;
    }

    public filter<T extends Score>(scores: Array<T>): Array<T> {
        const mapFiltered = super.filter(scores);
        if (!this.query) return mapFiltered;
        const q = this.query;

        return mapFiltered.filter((score) => {
            if (q.pp.some()) {
                const actualPp = score.pp ?? (this.isPopulated(score) ? score.calculated.attributes.total : undefined);
                if (actualPp === undefined || !rangeContains(q.pp.unwrap(), actualPp)) return false;
            }

            // Calculations Check
            if (this.isPopulated(score)) {
                if (
                    q.stars.some() &&
                    !rangeContains(q.stars.unwrap(), score.calculated.difficulty.attributes.starRating)
                )
                    return false;

                if (q.ppfc.some()) {
                    const fcPp = score.calculatedFC?.attributes.total ?? score.calculated.attributes.total;
                    if (!rangeContains(q.ppfc.unwrap(), fcPp)) return false;
                }
            } else if (this.populated) {
                return false;
            }

            return true;
        });
    }

    protected getSortValue(score: Score): number {
        switch (this.sortType) {
            case EScoreQuerySort.Stars:
                return this.isPopulated(score) ? score.calculated.difficulty.attributes.starRating : 0;
            case EScoreQuerySort.PPFC:
                return this.isPopulated(score)
                    ? (score.calculatedFC?.attributes.total ?? score.calculated.attributes.total)
                    : 0;
            default:
                return super.getSortValue(score);
        }
    }

    protected partialDisplay(): Array<string> {
        const parts = super.partialDisplay();
        if (!this.query) return parts;
        const q = this.query;

        if (q.pp.some()) parts.push(`pp${this.formatRange(q.pp.unwrap())}`);
        if (q.ppfc.some()) parts.push(`ppfc${this.formatRange(q.ppfc.unwrap())}`);
        if (q.stars.some()) parts.push(`stars${this.formatRange(q.stars.unwrap())}`);

        return parts;
    }
}
