import { Score } from "@generated/adapter/types";
import { EScorePopulation, EScoreQuerySort } from "../enums/Score.enum";
import { PopulatedScoresQueryDto } from "../Score.dto";
import { ScoreWithMapsEvaluator } from "./ScoreWithMapsEvaluator";
import { ScoreUtils } from "./ScoreUtils";
import { rangeContains } from "@domain/utils/utils";
import { BeatmapUtils } from "./BeatmapUtils";

export class PopulatedScoreEvaluator<
    Q extends PopulatedScoresQueryDto = PopulatedScoresQueryDto,
> extends ScoreWithMapsEvaluator<Q> {
    public get population(): EScorePopulation {
        const q = this.query;

        if (
            q?.length.some() ||
            q?.bpm.some() ||
            q?.cs.some() ||
            q?.ar.some() ||
            q?.hp.some() ||
            q?.od.some() ||
            q?.stars.some() ||
            q?.ppfc.some() ||
            this.sortType === EScoreQuerySort.Length ||
            this.sortType === EScoreQuerySort.BPM ||
            this.sortType === EScoreQuerySort.CS ||
            this.sortType === EScoreQuerySort.AR ||
            this.sortType === EScoreQuerySort.HP ||
            this.sortType === EScoreQuerySort.OD ||
            this.sortType === EScoreQuerySort.Stars ||
            this.sortType === EScoreQuerySort.PPFC
        ) {
            return EScorePopulation.Populated;
        }

        return super.population;
    }

    public filter<T extends Score>(scores: Array<T>): Array<T> {
        const baseFiltered = super.filter(scores);

        if (!this.query) {
            return baseFiltered;
        }

        const q = this.query;

        return baseFiltered.filter((score) => {
            if (q.pp.some()) {
                const actualPp =
                    score.pp ?? (ScoreUtils.isPopulated(score) ? score.calculated.attributes.total : undefined);

                if (actualPp === undefined || !rangeContains(q.pp.unwrap(), actualPp)) {
                    return false;
                }
            }

            const requiresPopulation =
                q.length.some() ||
                q.bpm.some() ||
                q.cs.some() ||
                q.ar.some() ||
                q.hp.some() ||
                q.od.some() ||
                q.stars.some() ||
                q.ppfc.some();

            if (!requiresPopulation) {
                return true;
            }

            if (!ScoreUtils.isPopulated(score)) {
                return false;
            }

            const attrs = score.calculated.difficulty.beatmap;

            if (q.length.some()) {
                if (!score.beatmap) {
                    return false;
                }

                const length = BeatmapUtils.length(score.beatmap.totalLength, attrs.clockRate);
                if (!rangeContains(q.length.unwrap(), length)) {
                    return false;
                }
            }

            if (q.bpm.some()) {
                if (!score.beatmap) {
                    return false;
                }

                const bpm = BeatmapUtils.bpm(score.beatmap.bpm, attrs.clockRate);
                if (!rangeContains(q.bpm.unwrap(), bpm)) {
                    return false;
                }
            }

            if (q.cs.some() && !rangeContains(q.cs.unwrap(), attrs.cs)) return false;
            if (q.ar.some() && !rangeContains(q.ar.unwrap(), attrs.ar)) return false;
            if (q.hp.some() && !rangeContains(q.hp.unwrap(), attrs.hp)) return false;
            if (q.od.some() && !rangeContains(q.od.unwrap(), attrs.od)) return false;
            if (q.stars.some() && !rangeContains(q.stars.unwrap(), score.fullDifficulty.starRating)) return false;

            if (q.ppfc.some()) {
                const fcPp = score.calculatedFC?.attributes.total ?? score.calculated.attributes.total;

                if (!rangeContains(q.ppfc.unwrap(), fcPp)) {
                    return false;
                }
            }

            return true;
        });
    }

    public getActiveAttributes(): Array<string> {
        const attrs = super.getActiveAttributes();
        const q = this.query;

        if (q?.cs.some() || this.sortType === EScoreQuerySort.CS) attrs.push("CS");
        if (q?.ar.some() || this.sortType === EScoreQuerySort.AR) attrs.push("AR");
        if (q?.od.some() || this.sortType === EScoreQuerySort.OD) attrs.push("OD");
        if (q?.hp.some() || this.sortType === EScoreQuerySort.HP) attrs.push("HP");
        if (q?.bpm.some() || this.sortType === EScoreQuerySort.BPM) attrs.push("BPM");
        if (q?.length.some() || this.sortType === EScoreQuerySort.Length) attrs.push("Length");

        return attrs;
    }

    protected getSortValue(score: Score): number {
        if (!ScoreUtils.isPopulated(score)) {
            return super.getSortValue(score);
        }

        const attrs = score.calculated.difficulty.beatmap;

        switch (this.sortType) {
            case EScoreQuerySort.CS:
                return attrs.cs;
            case EScoreQuerySort.AR:
                return attrs.ar;
            case EScoreQuerySort.OD:
                return attrs.od;
            case EScoreQuerySort.HP:
                return attrs.hp;
            case EScoreQuerySort.Length:
                return score.beatmap ? BeatmapUtils.length(score.beatmap.totalLength, attrs.clockRate) : 0;
            case EScoreQuerySort.BPM:
                return score.beatmap ? BeatmapUtils.bpm(score.beatmap.bpm, attrs.clockRate) : 0;
            case EScoreQuerySort.Stars:
                return score.fullDifficulty.starRating;
            case EScoreQuerySort.PPFC:
                return score.calculatedFC?.attributes.total ?? score.calculated.attributes.total;
            default:
                return super.getSortValue(score);
        }
    }

    protected partialDisplay(): Array<string> {
        const parts = super.partialDisplay();

        if (!this.query) {
            return parts;
        }

        const q = this.query;

        if (q.length.some()) parts.push(`length${this.formatRange(q.length.unwrap())}`);
        if (q.bpm.some()) parts.push(`bpm${this.formatRange(q.bpm.unwrap())}`);
        if (q.cs.some()) parts.push(`cs${this.formatRange(q.cs.unwrap())}`);
        if (q.ar.some()) parts.push(`ar${this.formatRange(q.ar.unwrap())}`);
        if (q.hp.some()) parts.push(`hp${this.formatRange(q.hp.unwrap())}`);
        if (q.od.some()) parts.push(`od${this.formatRange(q.od.unwrap())}`);
        if (q.pp.some()) parts.push(`pp${this.formatRange(q.pp.unwrap())}`);
        if (q.ppfc.some()) parts.push(`ppfc${this.formatRange(q.ppfc.unwrap())}`);
        if (q.stars.some()) parts.push(`stars${this.formatRange(q.stars.unwrap())}`);

        return parts;
    }
}
