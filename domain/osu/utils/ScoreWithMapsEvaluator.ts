import { Score } from "@generated/adapter/types";
import { EScoreQuerySort } from "../enums/Score.enum";
import { ScoresWithMapsQueryDto } from "../Score.dto";
import { BaseScoreEvaluator } from "./BaseScoreEvaluator";
import { rangeContains } from "@domain/utils/utils";
import { BeatmapAttributesCalculator } from "./BeatmapAttributesCalculator";
import { ModUtils } from "@generated/adapter/mods";
import { dateRangeContains } from "@domain/utils/dateTimeUtils";

export class ScoreWithMapsEvaluator<
    Q extends ScoresWithMapsQueryDto = ScoresWithMapsQueryDto,
> extends BaseScoreEvaluator<Q> {
    public get withMaps(): boolean {
        if (this.cleanedContent) return true;

        if (!this.query) {
            return (
                super.withMaps ||
                this.sortType === EScoreQuerySort.Length ||
                this.sortType === EScoreQuerySort.BPM ||
                this.sortType === EScoreQuerySort.RankDate
            );
        }

        const q = this.query;

        return (
            super.withMaps ||
            q.artist.some() ||
            q.creator.some() ||
            q.title.some() ||
            q.version.some() ||
            q.rankedDate.some() ||
            q.length.some() ||
            q.bpm.some() ||
            q.cs.some() ||
            q.ar.some() ||
            q.hp.some() ||
            q.od.some() ||
            this.sortType === EScoreQuerySort.Length ||
            this.sortType === EScoreQuerySort.BPM ||
            this.sortType === EScoreQuerySort.RankDate
        );
    }

    public filter<T extends Score>(scores: Array<T>): Array<T> {
        const baseFiltered = super.filter(scores);
        const hasQuery = !!this.query;
        const hasSearch = !!this.cleanedContent;

        if (!hasQuery && !hasSearch) return baseFiltered;

        const q = this.query;

        let searchTerms: Array<string> = [];
        if (hasSearch) {
            searchTerms = this.cleanedContent!.toLowerCase().split(/\s+/);
        }

        return baseFiltered.filter((score) => {
            if (score.beatmapset && score.beatmap) {
                if (hasSearch) {
                    const mapset = score.beatmapset;
                    const searchableTerms = [
                        mapset.artist.toLowerCase(),
                        mapset.creator.toLowerCase(),
                        mapset.title.toLowerCase(),
                        score.beatmap.version.toLowerCase(),
                        (mapset.tags || "").toLowerCase(),
                    ];

                    const matchesSearch = searchTerms.every((term) =>
                        searchableTerms.some((searchable) => searchable.includes(term)),
                    );

                    if (!matchesSearch) return false;
                }

                if (q) {
                    if (
                        q.artist.some() &&
                        !score.beatmapset.artist.toLowerCase().includes(q.artist.unwrap().toLowerCase())
                    )
                        return false;
                    if (
                        q.creator.some() &&
                        !score.beatmapset.creator.toLowerCase().includes(q.creator.unwrap().toLowerCase())
                    )
                        return false;
                    if (
                        q.title.some() &&
                        !score.beatmapset.title.toLowerCase().includes(q.title.unwrap().toLowerCase())
                    )
                        return false;
                    if (
                        q.version.some() &&
                        !score.beatmap.version.toLowerCase().includes(q.version.unwrap().toLowerCase())
                    )
                        return false;
                    if (q.rankedDate.some()) {
                        const rankedDate = score.beatmapset.rankedDate;
                        if (!rankedDate || !dateRangeContains(q.rankedDate.unwrap(), rankedDate)) {
                            return false;
                        }
                    }

                    const attrs = BeatmapAttributesCalculator.calculate(score.beatmap, score.mods);
                    const liveLength = BeatmapAttributesCalculator.length(score.beatmap.totalLength, attrs.clockRate);
                    const liveBpm = BeatmapAttributesCalculator.bpm(score.beatmap.bpm, attrs.clockRate);

                    if (q.length.some() && !rangeContains(q.length.unwrap(), liveLength)) return false;
                    if (q.bpm.some() && !rangeContains(q.bpm.unwrap(), liveBpm)) return false;
                    if (q.cs.some() && !rangeContains(q.cs.unwrap(), attrs.cs)) return false;
                    if (q.ar.some() && !rangeContains(q.ar.unwrap(), attrs.ar)) return false;
                    if (q.hp.some() && !rangeContains(q.hp.unwrap(), attrs.hp)) return false;
                    if (q.od.some() && !rangeContains(q.od.unwrap(), attrs.od)) return false;
                }
            } else if (this.withMaps) {
                return false;
            }
            return true;
        });
    }

    public getActiveAttributes(): Array<string> {
        const attrs = super.getActiveAttributes();
        const q = this.query;

        if (q?.cs.some()) attrs.push("CS");
        if (q?.ar.some()) attrs.push("AR");
        if (q?.od.some()) attrs.push("OD");
        if (q?.hp.some()) attrs.push("HP");

        if (q?.bpm.some() || this.sortType === EScoreQuerySort.BPM) {
            attrs.push("BPM");
        }

        if (q?.length.some() || this.sortType === EScoreQuerySort.Length) {
            attrs.push("Length");
        }

        if (q?.rankedDate.some() || this.sortType === EScoreQuerySort.RankDate) {
            attrs.push("RankDate");
        }

        return attrs;
    }

    protected getSortValue(score: Score): number {
        if (this.sortType === EScoreQuerySort.RankDate) {
            return score.beatmapset?.rankedDate?.getTime() ?? 0;
        }

        if (!score.beatmap) return super.getSortValue(score);

        const clockRate = ModUtils.clockRate(score.mods);
        switch (this.sortType) {
            case EScoreQuerySort.Length:
                return BeatmapAttributesCalculator.length(score.beatmap.totalLength, clockRate);
            case EScoreQuerySort.BPM:
                return BeatmapAttributesCalculator.bpm(score.beatmap.bpm, clockRate);
            default:
                return super.getSortValue(score);
        }
    }

    protected partialDisplay(): Array<string> {
        const parts = super.partialDisplay();

        if (this.cleanedContent) {
            parts.unshift(`search="${this.cleanedContent}"`);
        }

        if (!this.query) return parts;
        const q = this.query;

        if (q.artist.some()) parts.push(`artist="${q.artist.unwrap()}"`);
        if (q.creator.some()) parts.push(`creator="${q.creator.unwrap()}"`);
        if (q.title.some()) parts.push(`title="${q.title.unwrap()}"`);
        if (q.version.some()) parts.push(`diff="${q.version.unwrap()}"`);

        if (q.rankedDate.some()) parts.push(`rankdate${this.formatRange(q.rankedDate.unwrap())}`);

        if (q.length.some()) parts.push(`length${this.formatRange(q.length.unwrap())}`);
        if (q.bpm.some()) parts.push(`bpm${this.formatRange(q.bpm.unwrap())}`);
        if (q.cs.some()) parts.push(`cs${this.formatRange(q.cs.unwrap())}`);
        if (q.ar.some()) parts.push(`ar${this.formatRange(q.ar.unwrap())}`);
        if (q.hp.some()) parts.push(`hp${this.formatRange(q.hp.unwrap())}`);
        if (q.od.some()) parts.push(`od${this.formatRange(q.od.unwrap())}`);

        return parts;
    }
}
