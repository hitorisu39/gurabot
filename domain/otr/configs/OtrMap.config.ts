import { EOtrBeatmapRankRange } from "../OtrBeatmap.dto";

export const otrMapLeaderboardPageSize = 10;
export const otrMapTournamentsPageSize = 10;

export const otrBeatmapRankRangeLabel: Record<EOtrBeatmapRankRange, string> = {
    [EOtrBeatmapRankRange.Open]: "Open",
    [EOtrBeatmapRankRange.Lt1k]: "<1k",
    [EOtrBeatmapRankRange.Rank1kPlus]: "1k+",
    [EOtrBeatmapRankRange.Rank10kPlus]: "10k+",
    [EOtrBeatmapRankRange.Rank100kPlus]: "100k+",
};
