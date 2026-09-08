import { SerializableDto } from "@domain/core/Data";
import { EOtrRatingAdjustmentType, EOtrRuleset, EOtrVerificationStatus } from "@domain/otr/enums/Otr.enum";
import { OtrPlayerCompactDto } from "@domain/otr/OtrPlayer.dto";
import { Exclude, Expose, Type } from "class-transformer";

@Exclude()
export class OtrMatchTournamentDto extends SerializableDto {
    @Expose()
    declare id: number;

    @Expose()
    declare name: string;

    @Expose()
    declare abbreviation: string | null;

    @Expose()
    declare ruleset: EOtrRuleset;
}

@Exclude()
export class OtrPlayerMatchStatsDto extends SerializableDto {
    @Expose()
    declare id: number;

    @Expose({ name: "playerId" })
    declare playerID: number;

    @Expose({ name: "matchId" })
    declare matchID: number;

    @Expose()
    declare won: boolean;

    @Expose()
    declare gamesWon: number;

    @Expose()
    declare gamesLost: number;

    @Expose()
    declare gamesPlayed: number;

    @Expose()
    declare averageScore: number;

    @Expose()
    declare averageAccuracy: number;

    @Expose()
    declare averageMisses: number;

    @Expose()
    declare averagePlacement: number;

    @Expose()
    declare matchCost: number;

    @Expose({ name: "teammateIds" })
    declare teammateIDs: Array<number>;

    @Expose({ name: "opponentIds" })
    declare opponentIDs: Array<number>;
}

@Exclude()
export class OtrMatchRatingAdjustmentDto extends SerializableDto {
    @Expose()
    declare id: number;

    @Expose()
    declare adjustmentType: EOtrRatingAdjustmentType;

    @Expose()
    declare ruleset: EOtrRuleset;

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

    @Expose({ name: "playerRatingId" })
    declare playerRatingID: number;

    @Expose({ name: "playerId" })
    declare playerID: number;

    @Expose({ name: "matchId" })
    declare matchID: number | null;

    @Expose()
    declare ratingDelta: number;

    @Expose()
    declare volatilityDelta: number;
}

@Exclude()
export class OtrMatchBeatmapsetDto extends SerializableDto {
    @Expose()
    declare artist: string;

    @Expose()
    declare title: string;
}

@Exclude()
export class OtrMatchBeatmapDto extends SerializableDto {
    @Expose()
    declare id: number;

    @Expose({ name: "osuId" })
    declare osuID: number;

    @Expose()
    declare ruleset: EOtrRuleset;

    @Expose()
    declare diffName: string;

    @Expose()
    declare totalLength: number;

    @Expose()
    declare drainLength: number;

    @Expose()
    declare bpm: number;

    @Expose()
    declare cs: number;

    @Expose()
    declare hp: number;

    @Expose()
    declare od: number;

    @Expose()
    declare ar: number;

    @Expose()
    declare sr: number;

    @Expose()
    declare maxCombo: number | null;

    @Expose()
    @Type(() => OtrMatchBeatmapsetDto)
    declare beatmapset: OtrMatchBeatmapsetDto | null;
}

@Exclude()
export class OtrGameScoreDto extends SerializableDto {
    @Expose()
    declare id: number;

    @Expose({ name: "gameId" })
    declare gameID: number;

    @Expose({ name: "playerId" })
    declare playerID: number;

    @Expose()
    declare score: number;

    @Expose()
    declare placement: number;

    @Expose()
    declare accuracy: number;

    @Expose()
    declare maxCombo: number;

    @Expose()
    declare mods: number;

    @Expose()
    declare statMiss: number | null;

    @Expose()
    declare team: number;

    @Expose()
    declare ruleset: EOtrRuleset;

    @Expose()
    declare verificationStatus: EOtrVerificationStatus;
}

@Exclude()
export class OtrMatchGameDto extends SerializableDto {
    @Expose()
    declare id: number;

    @Expose({ name: "osuId" })
    declare osuID: number;

    @Expose({ name: "matchId" })
    declare matchID: number;

    @Expose({ name: "beatmapId" })
    declare beatmapID: number | null;

    @Expose()
    declare ruleset: EOtrRuleset;

    @Expose()
    declare scoringType: number;

    @Expose()
    declare teamType: number;

    @Expose()
    declare mods: number;

    @Expose()
    declare isFreeMod: boolean;

    @Expose()
    @Type(() => Date)
    declare startTime: Date | null;

    @Expose()
    @Type(() => Date)
    declare endTime: Date | null;

    @Expose()
    declare verificationStatus: EOtrVerificationStatus;

    @Expose()
    @Type(() => OtrMatchBeatmapDto)
    declare beatmap: OtrMatchBeatmapDto | null;

    @Expose()
    @Type(() => OtrGameScoreDto)
    declare scores: Array<OtrGameScoreDto>;
}

@Exclude()
export class OtrMatchWinRecordDto extends SerializableDto {
    @Expose({ name: "matchId" })
    declare matchID: number;

    @Expose()
    declare isTied: boolean;

    @Expose()
    declare loserRoster: Array<number> | null;

    @Expose()
    declare winnerRoster: Array<number> | null;

    @Expose()
    declare loserPoints: number;

    @Expose()
    declare winnerPoints: number;

    @Expose()
    declare loserTeam: number | null;

    @Expose()
    declare winnerTeam: number | null;
}

@Exclude()
export class OtrMatchDetailDto extends SerializableDto {
    @Expose()
    declare id: number;

    @Expose({ name: "osuId" })
    declare osuID: number;

    @Expose({ name: "tournamentId" })
    declare tournamentID: number;

    @Expose()
    declare name: string;

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
    declare warningFlags: number;

    @Expose()
    declare isLazer: boolean;

    @Expose()
    declare dataFetchStatus: number;

    @Expose()
    declare verifiedByUsername: string | null;

    @Expose()
    @Type(() => OtrMatchTournamentDto)
    declare tournament: OtrMatchTournamentDto | null;

    @Expose()
    @Type(() => OtrPlayerCompactDto)
    declare players: Array<OtrPlayerCompactDto>;

    @Expose()
    @Type(() => OtrPlayerMatchStatsDto)
    declare playerMatchStats: Array<OtrPlayerMatchStatsDto>;

    @Expose()
    @Type(() => OtrMatchRatingAdjustmentDto)
    declare ratingAdjustments: Array<OtrMatchRatingAdjustmentDto>;

    @Expose()
    @Type(() => OtrMatchGameDto)
    declare games: Array<OtrMatchGameDto>;

    @Expose()
    @Type(() => OtrMatchWinRecordDto)
    declare winRecord: OtrMatchWinRecordDto | null;
}
