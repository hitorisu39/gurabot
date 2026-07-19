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
}