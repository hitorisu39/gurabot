export enum EScorePopulation {
    None = 0,
    Maps = 1,
    Populated = 2,
}

export enum EScoreQuerySort {
    Accuracy = "Accuracy",
    Combo = "Combo",
    Misses = "Misses",
    Score = "Score",
    Date = "Date",
    PP = "PP",
    Stars = "Stars",
    Length = "Length",
    BPM = "BPM",
    PPFC = "PPFC",
    RankDate = "RankDate",
    CS = "CS",
    AR = "AR",
    OD = "OD",
    HP = "HP",
}

export enum ESortOrder {
    Ascending = "Asc",
    Descending = "Desc",
}

export enum EScoreListSize {
    Detailed = "Detailed",
    Compact = "Compact",
}

export enum EScoreViewLayout {
    List = "List",
    Compare = "Compare",
}

export enum EPersonalBestCase {
    ScorePresent = "ScorePresent",
    ScorePresentPresumably = "ScorePresentPresumably",
    NotRanked = "NotRanked",
    ScoreWorse = "ScoreWorse",
}
