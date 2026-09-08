import { SerializableDto } from "@domain/core/Data";
import { EOtrRuleset, EOtrVerificationStatus } from "@domain/otr/enums/Otr.enum";
import { OtrPlayerDto } from "@domain/otr/OtrPlayer.dto";
import { Exclude, Expose, Type } from "class-transformer";

@Exclude()
export class OtrTournamentPlayerStatsDto extends SerializableDto {
    @Expose()
    declare id: number;

    @Expose({ name: "playerId" })
    declare playerID: number;

    @Expose({ name: "tournamentId" })
    declare tournamentID: number;

    @Expose()
    declare matchesPlayed: number;

    @Expose()
    declare matchesWon: number;

    @Expose()
    declare matchesLost: number;

    @Expose()
    declare gamesPlayed: number;

    @Expose()
    declare gamesWon: number;

    @Expose()
    declare gamesLost: number;

    @Expose()
    declare averageMatchCost: number;

    @Expose()
    declare averageRatingDelta: number;

    @Expose()
    declare averageScore: number;

    @Expose()
    declare averagePlacement: number;

    @Expose()
    declare averageAccuracy: number;

    @Expose({ name: "teammateIds" })
    declare teammateIDs: Array<number>;

    @Expose()
    declare matchWinRate: number;

    @Expose()
    declare ratingBefore: number;

    @Expose()
    declare ratingAfter: number;

    @Expose()
    @Type(() => OtrPlayerDto)
    declare player: OtrPlayerDto;
}

@Exclude()
export class OtrTournamentMatchDto extends SerializableDto {
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
    declare isLazer: boolean;
}

@Exclude()
export class OtrTournamentDetailDto extends SerializableDto {
    @Expose()
    declare id: number;

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
    declare verificationStatus: EOtrVerificationStatus;

    @Expose()
    declare rejectionReason: number;

    @Expose()
    declare isLazer: boolean;

    @Expose()
    @Type(() => Date)
    declare startTime: Date | null;

    @Expose()
    @Type(() => Date)
    declare endTime: Date | null;

    @Expose()
    declare submittedByUsername: string | null;

    @Expose()
    declare verifiedByUsername: string | null;

    @Expose()
    @Type(() => OtrTournamentMatchDto)
    declare matches: Array<OtrTournamentMatchDto>;

    @Expose()
    @Type(() => OtrTournamentPlayerStatsDto)
    declare playerTournamentStats: Array<OtrTournamentPlayerStatsDto>;
}
