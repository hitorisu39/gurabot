import { SerializableDto } from "@domain/core/Data";
import { EOtrRuleset, EOtrVerificationStatus } from "@domain/otr/enums/Otr.enum";
import { OtrPlayerCompactDto } from "@domain/otr/OtrPlayer.dto";
import { Exclude, Expose, Type } from "class-transformer";

export enum EOtrBeatmapRankRange {
    Open = "open",
    Lt1k = "lt1k",
    Rank1kPlus = "1kPlus",
    Rank10kPlus = "10kPlus",
    Rank100kPlus = "100kPlus",
}

@Exclude()
export class OtrBeatmapReferenceDto extends SerializableDto {
    @Expose()
    declare id: number;

    @Expose({ name: "osuId" })
    declare osuID: number;

    @Expose()
    declare ruleset: EOtrRuleset;

    @Expose()
    declare diffName: string;
}

@Exclude()
export class OtrBeatmapStatsSummaryDto extends SerializableDto {
    @Expose()
    declare totalGameCount: number;

    @Expose()
    declare totalTournamentCount: number;

    @Expose()
    declare verifiedTournamentCount: number;

    @Expose()
    declare totalPlayedGameCount: number;

    @Expose()
    declare pooledPlayedTournamentCount: number;
}

@Exclude()
export class OtrBeatmapTournamentReferenceDto extends SerializableDto {
    @Expose()
    declare id: number;

    @Expose()
    declare name: string;
}

@Exclude()
export class OtrBeatmapTournamentUsageDto extends SerializableDto {
    @Expose()
    @Type(() => OtrBeatmapTournamentReferenceDto)
    declare tournament: OtrBeatmapTournamentReferenceDto;

    @Expose()
    declare gameCount: number;

    @Expose()
    declare scoreCount: number;

    @Expose()
    declare rankRangeLowerBound: number;

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
    declare mostCommonMods: number | null;

    @Expose()
    declare mostCommonModsFreemod: boolean;
}

@Exclude()
export class OtrBeatmapModDistributionDto extends SerializableDto {
    @Expose()
    declare mods: number;

    @Expose()
    declare scoreCount: number;

    @Expose()
    declare percentage: number;
}

@Exclude()
export class OtrBeatmapTopPerformerDto extends SerializableDto {
    @Expose()
    @Type(() => OtrPlayerCompactDto)
    declare player: OtrPlayerCompactDto;

    @Expose()
    declare score: number;

    @Expose()
    declare accuracy: number | null;

    @Expose()
    declare mods: number;

    @Expose()
    @Type(() => Date)
    declare playedAt: Date | null;

    @Expose({ name: "matchId" })
    declare matchID: number;

    @Expose({ name: "gameId" })
    declare gameID: number;

    @Expose({ name: "scoreId" })
    declare scoreID: number;

    @Expose()
    @Type(() => OtrBeatmapTournamentReferenceDto)
    declare tournament: OtrBeatmapTournamentReferenceDto;
}

@Exclude()
export class OtrBeatmapMissBucketDto extends SerializableDto {
    @Expose()
    declare misses: number;

    @Expose()
    declare scoreCount: number;
}

@Exclude()
export class OtrBeatmapPerformanceDto extends SerializableDto {
    @Expose()
    declare scoreCount: number;

    @Expose()
    declare missDataScoreCount: number;

    @Expose()
    @Type(() => OtrBeatmapMissBucketDto)
    declare missDistribution: Array<OtrBeatmapMissBucketDto>;
}

@Exclude()
export class OtrBeatmapFreemodSummaryDto extends SerializableDto {
    @Expose()
    declare freemodGameCount: number;

    @Expose()
    declare freemodScoreCount: number;

    @Expose()
    @Type(() => OtrBeatmapModDistributionDto)
    declare distribution: Array<OtrBeatmapModDistributionDto>;
}

@Exclude()
export class OtrBeatmapRankRangeModDistributionDto extends SerializableDto {
    @Expose()
    declare rankRange: EOtrBeatmapRankRange;

    @Expose()
    declare scoreCount: number;

    @Expose()
    @Type(() => OtrBeatmapModDistributionDto)
    declare distribution: Array<OtrBeatmapModDistributionDto>;
}

@Exclude()
export class OtrBeatmapStatsDto extends SerializableDto {
    @Expose()
    @Type(() => OtrBeatmapReferenceDto)
    declare beatmap: OtrBeatmapReferenceDto;

    @Expose()
    @Type(() => OtrBeatmapStatsSummaryDto)
    declare summary: OtrBeatmapStatsSummaryDto;

    @Expose()
    @Type(() => OtrBeatmapTournamentUsageDto)
    declare tournaments: Array<OtrBeatmapTournamentUsageDto>;

    @Expose()
    @Type(() => OtrBeatmapModDistributionDto)
    declare modDistribution: Array<OtrBeatmapModDistributionDto>;

    @Expose()
    @Type(() => OtrBeatmapTopPerformerDto)
    declare topPerformers: Array<OtrBeatmapTopPerformerDto>;

    @Expose()
    @Type(() => OtrBeatmapPerformanceDto)
    declare performance: OtrBeatmapPerformanceDto;

    @Expose()
    @Type(() => OtrBeatmapFreemodSummaryDto)
    declare freemodPicks: OtrBeatmapFreemodSummaryDto;

    @Expose()
    @Type(() => OtrBeatmapRankRangeModDistributionDto)
    declare rankRangeModDistribution: Array<OtrBeatmapRankRangeModDistributionDto>;
}
