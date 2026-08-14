import { SchemaModel, Field } from "../builder";

export const MonthlyPlaycounts = SchemaModel.define("MonthlyPlaycounts", {
    startDate: Field.String(),
    count: Field.Int(),
});

export const ReplaysWatchedCounts = SchemaModel.define("ReplaysWatchedCounts", {
    startDate: Field.String(),
    count: Field.Int(),
});

export const HighestRank = SchemaModel.define("HighestRank", {
    rank: Field.Int(),
    updatedAt: Field.Date(),
});

export const RankHistory = SchemaModel.define("RankHistory", {
    data: Field.Int().Array(),
});

export const UserAchievement = SchemaModel.define("UserAchievement", {
    achievedAt: Field.Date(),
    achievementID: Field.Int(),
});

export const UserLevel = SchemaModel.define("UserLevel", {
    current: Field.Int(),
    progress: Field.Int(),
});

export const UserGrades = SchemaModel.define("UserGrades", {
    ss: Field.Int(),
    ssh: Field.Int(),
    s: Field.Int(),
    sh: Field.Int(),
    a: Field.Int(),
});

export const UserStatistics = SchemaModel.define("UserStatistics", {
    count100: Field.Int(),
    count300: Field.Int(),
    count50: Field.Int(),
    countMiss: Field.Int(),
    level: Field.Model(UserLevel),
    globalRank: Field.Int(),
    countryRank: Field.Int(),
    pp: Field.Float(),
    rankedScore: Field.Int(),
    accuracy: Field.Float(),
    playcount: Field.Int(),
    playtime: Field.Int(),
    totalScore: Field.Int(),
    totalHits: Field.Int(),
    maxCombo: Field.Int(),
    replaysWatched: Field.Int(),
    grades: Field.Model(UserGrades),
});

export const DailyChallengeStatistics = SchemaModel.define("DailyChallengeStatistics", {
    dailyStreakBest: Field.Int(),
    dailyStreakCurrent: Field.Int(),
    lastUpdate: Field.Date(),
    lastWeeklyStreak: Field.Date(),
    playcount: Field.Int(),
    weeklyStreakBest: Field.Int(),
    weeklyStreakCurrent: Field.Int(),
    top10p: Field.Int(),
    top50p: Field.Int(),
});

export const Team = SchemaModel.define("Team", {
    flagUrl: Field.String(),
    id: Field.Int(),
    name: Field.String(),
    shortName: Field.String(),
});

export const Badge = SchemaModel.define("Badge", {
    awardedAt: Field.Date(),
    description: Field.String(),
    imageUrl: Field.String(),
    imageDoubleUrl: Field.String(),
    url: Field.String(),
});

export const User = SchemaModel.define("User", {
    id: Field.Int(),
    username: Field.String(),
    previousUsernames: Field.String().Array(),
    countryCode: Field.String(),
    avatarUrl: Field.String(),
    followers: Field.Int(),
    mappingFollowers: Field.Int(),

    joinDate: Field.Date(),
    lastVisit: Field.Date().Optional(),
    online: Field.Boolean().Optional(),

    monthlyPlaycounts: Field.Model(MonthlyPlaycounts).Array().Optional(),
    replaysWatchedCounts: Field.Model(ReplaysWatchedCounts).Array().Optional(),
    rankHistory: Field.Model(RankHistory).Optional(),
    achievements: Field.Model(UserAchievement).Array().Optional(),
    badges: Field.Model(Badge).Array().Optional(),
    highestRank: Field.Model(HighestRank).Optional(),
    team: Field.Model(Team).Optional(),
    dailyChallenge: Field.Model(DailyChallengeStatistics).Optional(),

    statistics: Field.Model(UserStatistics),

    scoresBestCount: Field.Int(),
    scoresFirstCount: Field.Int(),
    scoresPinnedCount: Field.Int(),
    scoresRecentCount: Field.Int(),

    // Mapping
    beatmapsetPendingCount: Field.Int(),
    beatmapsetRankedCount: Field.Int(),
    beatmapsetNominatedCount: Field.Int(),
    beatmapsetGraveyardCount: Field.Int(),
    beatmapsetLovedCount: Field.Int(),
    beatmapsetGuestCount: Field.Int(),

    // Not mapping
    beatmapsetFavoriteCount: Field.Int(),
});

export const RankingUser = SchemaModel.define("RankingUser", {
    id: Field.Int(),
    username: Field.String(),
    countryCode: Field.String(),
    avatarUrl: Field.String(),

    online: Field.Boolean().Optional(),
    lastVisit: Field.Date().Optional(),
});

export const RankingStatistics = SchemaModel.define("RankingStatistics", {
    index: Field.Int(),

    globalRank: Field.Int().Optional(),
    countryRank: Field.Int().Optional(),

    pp: Field.Float(),
    accuracy: Field.Float(),

    playcount: Field.Int(),
    playtime: Field.Int().Optional(),

    rankedScore: Field.Int(),
    totalScore: Field.Int(),
    totalHits: Field.Int(),

    maxCombo: Field.Int(),
    replaysWatched: Field.Int(),

    rankChangeSince30Days: Field.Int().Optional(),

    level: Field.Model(UserLevel),
    grades: Field.Model(UserGrades),

    user: Field.Model(RankingUser),
});
