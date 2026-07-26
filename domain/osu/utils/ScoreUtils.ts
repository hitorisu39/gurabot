import { Score } from "@generated/adapter/types";
import { PopulatedScore, ScoreWithMaps } from "../Score.dto";

export class ScoreUtils {
    public static hasMaps(score: Score): score is ScoreWithMaps {
        return score.beatmap !== undefined && score.beatmapset !== undefined;
    }

    public static isPopulated(score: Score): score is PopulatedScore {
        return "calculated" in score;
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
