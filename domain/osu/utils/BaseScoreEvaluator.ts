import {
    CommandOption,
    EModMatchType,
    ICommandDateRange,
    ICommandMods,
    ICommandQueryData,
    ICommandRange,
} from "@domain/core/Command";
import { BaseScoreQueryDto } from "../Score.dto";
import { EScorePopulation, EScoreQuerySort, ESortOrder } from "../enums/Score.enum";
import { Grade, Score } from "@generated/adapter/types";
import { rangeContains } from "@domain/utils/utils";
import { ModUtils } from "@generated/adapter/mods";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { dateRangeContains } from "@domain/utils/dateTimeUtils";

export class BaseScoreEvaluator<Q extends BaseScoreQueryDto = BaseScoreQueryDto> {
    protected query: Q | null;
    protected cleanedContent: string | null;

    constructor(
        option: CommandOption<ICommandQueryData<Q>>,
        protected mods: CommandOption<ICommandMods>,
        protected indexOption: CommandOption<ICommandRange>,
        protected gradeOption: CommandOption<Grade>,
        protected sortType: EScoreQuerySort = EScoreQuerySort.PP,
        protected order: ESortOrder = ESortOrder.Descending,
    ) {
        this.query = option.some() ? option.unwrap().data : null;
        this.cleanedContent = option.some() ? option.unwrap().cleanedContent?.trim() || null : null;
    }

    public get population(): EScorePopulation {
        return EScorePopulation.None;
    }

    public filter<T extends Score>(scores: Array<T>): Array<T> {
        let filtered = scores;

        if (this.gradeOption.some()) {
            const grade = this.gradeOption.unwrap();
            filtered = filtered.filter((score) => score.grade === grade);
        }

        if (this.mods.some()) {
            const modReq = this.mods.unwrap();
            const targetAcronyms = ModUtils.fromString(modReq.mods).map((m) => m.acronym);

            filtered = filtered.filter((score) => {
                const scoreAcronyms = score.mods.map((m) => m.acronym);

                switch (modReq.type) {
                    case EModMatchType.Include:
                        return targetAcronyms.every((m) => scoreAcronyms.includes(m));
                    case EModMatchType.Match:
                        return (
                            scoreAcronyms.length === targetAcronyms.length &&
                            targetAcronyms.every((m) => scoreAcronyms.includes(m))
                        );
                    case EModMatchType.Exclude:
                        return !targetAcronyms.some((m) => scoreAcronyms.includes(m));
                    default:
                        return true;
                }
            });
        }

        if (this.query) {
            const q = this.query;
            filtered = filtered.filter((score) => {
                if (q.accuracy.some() && !rangeContains(q.accuracy.unwrap(), score.accuracy)) return false;
                if (q.combo.some() && !rangeContains(q.combo.unwrap(), score.maxCombo)) return false;
                if (q.misses.some() && !rangeContains(q.misses.unwrap(), score.statistics.miss)) return false;
                if (q.score.some() && !rangeContains(q.score.unwrap(), score.totalScore)) return false;
                if (q.date.some() && !dateRangeContains(q.date.unwrap(), score.endedAt)) return false;
                return true;
            });
        }

        return filtered;
    }

    public index<T extends Score>(scores: Array<T>): Array<T> {
        if (!this.indexOption.some()) return scores;

        const range = this.indexOption.unwrap();

        if (range.exact !== undefined) {
            const exactIdx = range.exact - 1;
            return scores[exactIdx] ? [scores[exactIdx]] : [];
        }

        const min = range.min ? (range.minInclusive ? range.min - 1 : range.min) : 0;
        const max = range.max ? (range.maxInclusive ? range.max : range.max - 1) : scores.length;

        return scores.slice(Math.max(0, min), Math.max(0, max));
    }

    public sort<T extends Score>(scores: Array<T>): Array<T> {
        return scores.sort((a, b) => {
            const valA = this.getSortValue(a);
            const valB = this.getSortValue(b);
            return this.order === ESortOrder.Ascending ? valA - valB : valB - valA;
        });
    }

    public getActiveAttributes(): Array<string> {
        return [];
    }

    protected getSortValue(score: Score): number {
        switch (this.sortType) {
            case EScoreQuerySort.Accuracy:
                return score.accuracy;
            case EScoreQuerySort.Combo:
                return score.maxCombo;
            case EScoreQuerySort.Misses:
                return score.statistics.miss;
            case EScoreQuerySort.Score:
                return score.totalScore;
            case EScoreQuerySort.Date:
                return score.endedAt.getTime();
            case EScoreQuerySort.PP:
                return score.pp ?? 0;
            default:
                return 0;
        }
    }

    protected formatRange(r: ICommandRange | ICommandDateRange | number | Date): string {
        if (typeof r === "number") return `=${r}`;
        if (r instanceof Date) return `=${r.toISOString().split("T")[0]}`;

        if ("display" in r && r.display) {
            return r.display;
        }

        if (r.exact !== undefined) {
            return `=${r.exact instanceof Date ? r.exact.toISOString().split("T")[0] : r.exact}`;
        }

        let min = r.min;
        let max = r.max;

        if (min === -Infinity) min = undefined;
        if (max === Infinity) max = undefined;

        const minStr = min instanceof Date ? min.toISOString().split("T")[0] : min;
        const maxStr = max instanceof Date ? max.toISOString().split("T")[0] : max;

        if (minStr !== undefined && maxStr !== undefined) return `=${minStr}-${maxStr}`;
        if (minStr !== undefined) return `${r.minInclusive ? ">=" : ">"}${minStr}`;
        if (maxStr !== undefined) return `${r.maxInclusive ? "<=" : "<"}${maxStr}`;
        return "";
    }

    protected partialDisplay(): Array<string> {
        const parts: Array<string> = [];

        if (this.indexOption.some()) {
            parts.push(`index${this.formatRange(this.indexOption.unwrap())}`);
        }

        if (this.query) {
            const q = this.query;
            if (q.accuracy.some()) parts.push(`acc${this.formatRange(q.accuracy.unwrap())}`);
            if (q.combo.some()) parts.push(`combo${this.formatRange(q.combo.unwrap())}`);
            if (q.misses.some()) parts.push(`misses${this.formatRange(q.misses.unwrap())}`);
            if (q.score.some()) parts.push(`score${this.formatRange(q.score.unwrap())}`);
        }

        return parts;
    }

    public display(count: number, suffix: string = "matching the filters:"): string | null {
        const queryParts = this.partialDisplay();
        const isDefaultSort = this.sortType === EScoreQuerySort.PP && this.order === ESortOrder.Descending;

        if (!this.mods.some() && queryParts.length === 0 && isDefaultSort) {
            return null;
        }

        const parts: Array<string> = [];

        if (this.gradeOption.some()) {
            parts.push(`Grade: \`${this.gradeOption.unwrap()}\``);
        }

        if (this.mods.some()) {
            const m = this.mods.unwrap();
            const typeStr = String(m.type).charAt(0).toUpperCase() + String(m.type).slice(1).toLowerCase();
            parts.push(`Mods: \`${typeStr} ${m.mods || "NM"}\``);
        }

        const rawSort = String(this.sortType);
        const sortStr =
            rawSort.toLowerCase() === "pp" || rawSort.toLowerCase() === "ppfc"
                ? rawSort.toUpperCase()
                : rawSort.charAt(0).toUpperCase() + rawSort.slice(1).toLowerCase();

        const orderStr = this.order === ESortOrder.Descending ? "Desc" : "Asc";
        parts.push(`Order: \`${sortStr} (${orderStr})\``);

        if (queryParts.length > 0) {
            let queryStr = queryParts.join(", ");
            if (queryStr.length > 100) queryStr = queryStr.slice(0, 97) + "...";
            parts.push(`Query: \`${queryStr}\``);
        }

        let text = parts.join(" ~ ");

        if (this.mods.some() || queryParts.length > 0) {
            text += `\nFound **${count}** ${DiscordFormatter.plural(count, "score")} ${suffix}`;
        }

        return text;
    }
}
