import { EOsuStatsScoreSort } from "../enums/OsuStatsScores.enum";

export const osuStatsScoreSortValue: Record<EOsuStatsScoreSort, number> = {
    [EOsuStatsScoreSort.Date]: 0,
    [EOsuStatsScoreSort.PP]: 1,
    [EOsuStatsScoreSort.Rank]: 2,
    [EOsuStatsScoreSort.Accuracy]: 3,
    [EOsuStatsScoreSort.Combo]: 4,
    [EOsuStatsScoreSort.Score]: 5,
    [EOsuStatsScoreSort.Misses]: 6,
};
