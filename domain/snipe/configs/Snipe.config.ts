import { ESnipePlayerChangeType, ESnipePlayerListSort, ESnipeRankingSort } from "../enums/Snipe.enum";

export const snipeBaseUrl = "https://snipe.huismetbenen.nl";
export const snipeRankingPageSize = 10;
export const snipePlayerListPageSize = 10;
export const snipePlayerListApiPageSize = 50;
export const snipePlayerChangesPageSize = 10;

export const snipeRankingSortPath: Record<ESnipeRankingSort, string> = {
    [ESnipeRankingSort.WeightedPP]: "pp/weighted",
    [ESnipeRankingSort.Count]: "count",
    [ESnipeRankingSort.AveragePP]: "pp/average",
    [ESnipeRankingSort.AverageStars]: "sr/average",
};

export const snipeRankingSortLabel: Record<ESnipeRankingSort, string> = {
    [ESnipeRankingSort.WeightedPP]: "Weighted PP",
    [ESnipeRankingSort.Count]: "#1 Count",
    [ESnipeRankingSort.AveragePP]: "Average PP",
    [ESnipeRankingSort.AverageStars]: "Average Stars",
};

export const snipePlayerListSortValue: Record<ESnipePlayerListSort, string> = {
    [ESnipePlayerListSort.PP]: "pp",
    [ESnipePlayerListSort.Accuracy]: "accuracy",
    [ESnipePlayerListSort.Stars]: "sr",
    [ESnipePlayerListSort.Misses]: "count_miss",
    [ESnipePlayerListSort.Date]: "date_set",
};

export const snipePlayerChangeEndpoint: Record<ESnipePlayerChangeType, string> = {
    [ESnipePlayerChangeType.Gain]: "new",
    [ESnipePlayerChangeType.Loss]: "old",
};
