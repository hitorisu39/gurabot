import { ESortOrder } from "@domain/osu/enums/Score.enum";
import { EOsuStatsBestSort } from "../enums/OsuStatsBest.enum";
import { OsuStatsBestScoreDto } from "../OsuStatsBest.dto";

export class OsuStatsBestEvaluator {
    public constructor(
        private readonly sortBy: EOsuStatsBestSort,
        private readonly order: ESortOrder,
    ) {}

    public sort(scores: Array<OsuStatsBestScoreDto>): Array<OsuStatsBestScoreDto> {
        return [...scores].sort((a, b) => {
            const result = this.compare(a, b);
            return this.order === ESortOrder.Ascending ? result : -result;
        });
    }

    private compare(a: OsuStatsBestScoreDto, b: OsuStatsBestScoreDto): number {
        switch (this.sortBy) {
            case EOsuStatsBestSort.Accuracy:
                return a.accuracy - b.accuracy;
            case EOsuStatsBestSort.Combo:
                return a.maxCombo - b.maxCombo;
            case EOsuStatsBestSort.Date:
                return a.endedAt.getTime() - b.endedAt.getTime();
            case EOsuStatsBestSort.LeaderboardPosition:
                return a.position - b.position;
            case EOsuStatsBestSort.Misses:
                return a.misses - b.misses;
            case EOsuStatsBestSort.Score:
                return a.score - b.score;
            case EOsuStatsBestSort.PP:
            default:
                return a.pp - b.pp;
        }
    }
}
