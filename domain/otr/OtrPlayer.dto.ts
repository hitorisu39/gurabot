import { SerializableDto } from "@domain/core/Data";
import { Exclude, Expose, Type } from "class-transformer";
import { EOtrRatingAdjustmentType, EOtrRuleset, EOtrVerificationStatus } from "@domain/otr/enums/Otr.enum";

@Exclude()
export class OtrPlayerDto extends SerializableDto {
    @Expose()
    declare id: number;

    @Expose({ name: "osuId" })
    declare osuID: number;

    @Expose()
    declare username: string;

    @Expose()
    declare country: string;

    @Expose()
    declare defaultRuleset: EOtrRuleset;

    @Expose()
    @Type(() => Date)
    declare osuLastFetch: Date;

    @Expose()
    @Type(() => Date)
    declare osuTrackLastFetch: Date | null;

    @Expose()
    declare osuTrackDataFetchStatus: number;

    @Expose()
    declare dataFetchStatus: number;
}

@Exclude()
export class OtrPlayerCompactDto extends SerializableDto {
    @Expose()
    declare id: number;

    @Expose({ name: "osuId" })
    declare osuID: number;

    @Expose()
    declare username: string;

    @Expose()
    declare country: string;

    @Expose()
    declare defaultRuleset: EOtrRuleset;
}

@Exclude()
export class OtrTierProgressDto extends SerializableDto {
    @Expose()
    declare currentTier: string;

    @Expose()
    declare currentSubTier: number | null;

    @Expose()
    declare nextTier: string | null;

    @Expose()
    declare nextSubTier: number | null;

    @Expose()
    declare ratingForNextTier: number;

    @Expose()
    declare ratingForNextMajorTier: number;

    @Expose()
    declare nextMajorTier: string | null;

    @Expose()
    declare subTierFillPercentage: number | null;

    @Expose()
    declare majorTierFillPercentage: number | null;
}

@Exclude()
export class OtrPlayerMatchReferenceDto extends SerializableDto {
    @Expose()
    declare id: number;

    @Expose()
    declare name: string;

    @Expose({ name: "tournamentId" })
    declare tournamentID: number | null;
}

@Exclude()
export class OtrPlayerRatingAdjustmentDto extends SerializableDto {
    @Expose({ name: "playerId" })
    declare playerID: number;

    @Expose()
    declare adjustmentType: EOtrRatingAdjustmentType;

    @Expose()
    @Type(() => Date)
    declare timestamp: Date;

    @Expose()
    declare ratingBefore: number;

    @Expose()
    declare ratingAfter: number;

    @Expose()
    declare volatilityBefore: number;

    @Expose()
    declare volatilityAfter: number;

    @Expose({ name: "matchId" })
    declare matchID: number | null;

    @Expose()
    declare ratingDelta: number;

    @Expose()
    declare volatilityDelta: number;

    @Expose()
    @Type(() => OtrPlayerMatchReferenceDto)
    declare match: OtrPlayerMatchReferenceDto | null;

    @Expose()
    declare gamesWon: number | null;

    @Expose()
    declare gamesLost: number | null;

    @Expose()
    declare matchWon: boolean | null;
}

@Exclude()
export class OtrPlayerRatingStatsDto extends SerializableDto {
    @Expose()
    declare ruleset: EOtrRuleset;

    @Expose()
    declare rating: number;

    @Expose()
    declare volatility: number;

    @Expose()
    declare percentile: number;

    @Expose()
    declare globalRank: number;

    @Expose()
    declare countryRank: number;

    @Expose()
    @Type(() => OtrPlayerCompactDto)
    declare player: OtrPlayerCompactDto;

    @Expose()
    declare tournamentsPlayed: number;

    @Expose()
    declare matchesPlayed: number;

    @Expose()
    declare winRate: number | null;

    @Expose()
    @Type(() => OtrTierProgressDto)
    declare tierProgress: OtrTierProgressDto;

    @Expose()
    @Type(() => OtrPlayerRatingAdjustmentDto)
    declare adjustments: Array<OtrPlayerRatingAdjustmentDto>;

    @Expose()
    declare isProvisional: boolean;
}

@Exclude()
export class OtrAggregatePlayerMatchStatsDto extends SerializableDto {
    @Expose()
    declare averageMatchCostAggregate: number;

    @Expose()
    declare highestRating: number | null;

    @Expose()
    declare ratingGained: number;

    @Expose()
    declare gamesWon: number;

    @Expose()
    declare gamesLost: number;

    @Expose()
    declare gamesPlayed: number;

    @Expose()
    declare matchesWon: number;

    @Expose()
    declare matchesLost: number;

    @Expose()
    declare matchesPlayed: number;

    @Expose()
    declare gameWinRate: number;

    @Expose()
    declare matchWinRate: number;

    @Expose()
    declare bestWinStreak: number;

    @Expose()
    declare matchAverageScoreAggregate: number;

    @Expose()
    declare matchAverageMissesAggregate: number;

    @Expose()
    declare matchAverageAccuracyAggregate: number;

    @Expose()
    declare averageGamesPlayedAggregate: number;

    @Expose()
    declare averagePlacingAggregate: number;

    @Expose()
    @Type(() => Date)
    declare periodStart: Date | null;

    @Expose()
    @Type(() => Date)
    declare periodEnd: Date | null;
}

@Exclude()
export class OtrPlayerModStatsDto extends SerializableDto {
    @Expose()
    declare mods: number;

    @Expose()
    declare count: number;

    @Expose()
    declare averageScore: number;
}

@Exclude()
export class OtrPlayerFrequencyDto extends SerializableDto {
    @Expose()
    @Type(() => OtrPlayerCompactDto)
    declare player: OtrPlayerCompactDto;

    @Expose()
    declare frequency: number;
}

@Exclude()
export class OtrPlayerModPerformanceDto extends SerializableDto {
    @Expose()
    declare label: string;

    @Expose()
    declare count: number;

    @Expose()
    declare medianScore: number;
}

@Exclude()
export class OtrPlayerStatsDto extends SerializableDto {
    @Expose()
    @Type(() => OtrPlayerCompactDto)
    declare playerInfo: OtrPlayerCompactDto;

    @Expose()
    declare ruleset: EOtrRuleset;

    @Expose()
    @Type(() => OtrPlayerRatingStatsDto)
    declare rating: OtrPlayerRatingStatsDto | null;

    @Expose()
    @Type(() => OtrAggregatePlayerMatchStatsDto)
    declare matchStats: OtrAggregatePlayerMatchStatsDto | null;

    @Expose()
    @Type(() => OtrPlayerModStatsDto)
    declare modStats: Array<OtrPlayerModStatsDto>;

    @Expose()
    @Type(() => OtrPlayerFrequencyDto)
    declare frequentTeammates: Array<OtrPlayerFrequencyDto>;

    @Expose()
    @Type(() => OtrPlayerFrequencyDto)
    declare frequentOpponents: Array<OtrPlayerFrequencyDto>;

    @Expose()
    @Type(() => OtrPlayerModPerformanceDto)
    declare modPerformance?: Array<OtrPlayerModPerformanceDto> | null;
}

@Exclude()
export class OtrPlayerRatingDto extends SerializableDto {
    @Expose({ name: "osuId" })
    declare osuID: number;

    @Expose()
    declare rating: number;

    @Expose()
    declare volatility: number;

    @Expose()
    declare peakRating: number;

    @Expose()
    declare verifiedTournamentsPlayed: number;

    @Expose()
    declare verifiedMatchesPlayed: number;

    @Expose()
    declare percentile: number;

    @Expose()
    declare tier: string;

    @Expose()
    declare subTier: number;
}

@Exclude()
export class OtrPlayerTournamentDto extends SerializableDto {
    @Expose()
    declare id: number;

    @Expose()
    @Type(() => Date)
    declare created: Date;

    @Expose()
    declare name: string;

    @Expose()
    declare abbreviation: string;

    @Expose()
    declare forumUrl: string;

    @Expose()
    declare rankRangeLowerBound: number;

    @Expose()
    declare ruleset: EOtrRuleset;

    @Expose()
    declare lobbySize: number;

    @Expose()
    @Type(() => Date)
    declare startTime: Date | null;

    @Expose()
    @Type(() => Date)
    declare endTime: Date | null;

    @Expose()
    declare verificationStatus: EOtrVerificationStatus;

    @Expose()
    declare rejectionReason: number;

    @Expose()
    declare isLazer: boolean;

    @Expose()
    declare submittedByUsername: string | null;

    @Expose()
    declare verifiedByUsername: string | null;

    @Expose()
    declare matchesWon: number;

    @Expose()
    declare matchesLost: number;
}
