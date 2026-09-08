import { Exclude, Expose, Type } from "class-transformer";
import { EOtrRuleset } from "@domain/otr/enums/Otr.enum";
import type { TOtrTier } from "@domain/otr/Otr.types";

@Exclude()
export class OtrLeaderboardPlayerDto {
    @Expose()
    declare id: number;

    @Expose()
    declare osuId: number;

    @Expose()
    declare username: string;

    @Expose()
    declare country: string;
}

@Exclude()
export class OtrLeaderboardTierProgressDto {
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
export class OtrLeaderboardEntryDto {
    @Expose()
    @Type(() => OtrLeaderboardPlayerDto)
    declare player: OtrLeaderboardPlayerDto;

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
    declare tournamentsPlayed: number;

    @Expose()
    declare matchesPlayed: number;

    @Expose()
    declare winRate: number;

    @Expose()
    declare tier: TOtrTier;

    @Expose()
    @Type(() => OtrLeaderboardTierProgressDto)
    declare tierProgress: OtrLeaderboardTierProgressDto;
}

@Exclude()
export class OtrLeaderboardPageDto {
    @Expose()
    declare page: number;

    @Expose()
    declare pageSize: number;

    @Expose()
    declare pages: number;

    @Expose()
    declare total: number;

    @Expose()
    declare ruleset: EOtrRuleset;

    @Expose()
    @Type(() => OtrLeaderboardEntryDto)
    declare leaderboard: Array<OtrLeaderboardEntryDto>;
}
