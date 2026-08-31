import { Score } from "@generated/adapter/types";
import { EScorePopulation, EScoreQuerySort } from "../enums/Score.enum";
import { ScoresWithMapsQueryDto } from "../Score.dto";
import { BaseScoreEvaluator } from "./BaseScoreEvaluator";
import { dateRangeContains } from "@domain/utils/dateTimeUtils";

export class ScoreWithMapsEvaluator<
    Q extends ScoresWithMapsQueryDto = ScoresWithMapsQueryDto,
> extends BaseScoreEvaluator<Q> {
    public get population(): EScorePopulation {
        const q = this.query;

        if (
            this.cleanedContent ||
            q?.artist.some() ||
            q?.creator.some() ||
            q?.title.some() ||
            q?.version.some() ||
            q?.rankedDate.some() ||
            this.sortType === EScoreQuerySort.RankDate
        ) {
            return EScorePopulation.Maps;
        }

        return super.population;
    }

    public filter<T extends Score>(scores: Array<T>): Array<T> {
        const baseFiltered = super.filter(scores);

        const hasQuery = !!this.query;
        const hasSearch = !!this.cleanedContent;

        if (!hasQuery && !hasSearch) {
            return baseFiltered;
        }

        const q = this.query;
        const searchTerms = hasSearch ? this.cleanedContent!.toLowerCase().split(/\s+/) : [];

        return baseFiltered.filter((score) => {
            if (!score.beatmap || !score.beatmapset) {
                return this.population < EScorePopulation.Maps;
            }

            const beatmap = score.beatmap;
            const beatmapset = score.beatmapset;

            if (hasSearch) {
                const searchableTerms = [
                    beatmapset.artist,
                    beatmapset.creator,
                    beatmapset.title,
                    beatmap.version,
                    beatmapset.tags ?? "",
                ].map((value) => value.toLowerCase());

                const matchesSearch = searchTerms.every((term) =>
                    searchableTerms.some((value) => value.includes(term)),
                );

                if (!matchesSearch) {
                    return false;
                }
            }

            if (!q) {
                return true;
            }

            if (q.artist.some() && !beatmapset.artist.toLowerCase().includes(q.artist.unwrap().toLowerCase())) {
                return false;
            }

            if (q.creator.some() && !beatmapset.creator.toLowerCase().includes(q.creator.unwrap().toLowerCase())) {
                return false;
            }

            if (q.title.some() && !beatmapset.title.toLowerCase().includes(q.title.unwrap().toLowerCase())) {
                return false;
            }

            if (q.version.some() && !beatmap.version.toLowerCase().includes(q.version.unwrap().toLowerCase())) {
                return false;
            }

            if (q.rankedDate.some()) {
                const rankedDate = beatmapset.rankedDate;
                if (!rankedDate || !dateRangeContains(q.rankedDate.unwrap(), rankedDate)) {
                    return false;
                }
            }

            return true;
        });
    }

    public getActiveAttributes(): Array<string> {
        const attrs = super.getActiveAttributes();

        if (this.query?.rankedDate.some() || this.sortType === EScoreQuerySort.RankDate) {
            attrs.push("RankDate");
        }

        return attrs;
    }

    protected getSortValue(score: Score): number {
        if (this.sortType === EScoreQuerySort.RankDate) {
            return score.beatmapset?.rankedDate?.getTime() ?? 0;
        }

        return super.getSortValue(score);
    }

    protected partialDisplay(): Array<string> {
        const parts = super.partialDisplay();

        if (this.cleanedContent) {
            parts.unshift(`search="${this.cleanedContent}"`);
        }

        if (!this.query) {
            return parts;
        }

        const q = this.query;

        if (q.artist.some()) parts.push(`artist="${q.artist.unwrap()}"`);
        if (q.creator.some()) parts.push(`creator="${q.creator.unwrap()}"`);
        if (q.title.some()) parts.push(`title="${q.title.unwrap()}"`);
        if (q.version.some()) parts.push(`diff="${q.version.unwrap()}"`);
        if (q.rankedDate.some()) parts.push(`rankdate${this.formatRange(q.rankedDate.unwrap())}`);

        return parts;
    }
}
