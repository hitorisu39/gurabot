import { EOsuStatsBestTimeframe } from "../enums/OsuStatsBest.enum";

export const osuStatsBestPageSize = 10;

export const osuStatsBestTimeframeValue: Record<EOsuStatsBestTimeframe, number> = {
    [EOsuStatsBestTimeframe.Yesterday]: 1,
    [EOsuStatsBestTimeframe.LastWeek]: 2,
    [EOsuStatsBestTimeframe.LastMonth]: 3,
};
