import { Exclude, Expose, Type } from "class-transformer";
import { EMatchCostTargetType, EMatchCostTeam } from "./enums/MatchCost.enum";

@Exclude()
export class MatchCostTargetDto {
    @Expose()
    declare type: EMatchCostTargetType;

    @Expose()
    declare id: number;
}

@Exclude()
export class MatchCostUserDto {
    @Expose()
    declare id: number;

    @Expose()
    declare username: string;

    @Expose()
    declare countryCode: string;
}

@Exclude()
export class MatchCostScoreDto {
    @Expose()
    declare userID: number;

    @Expose()
    declare score: number;

    @Expose()
    declare easy: boolean;

    @Expose()
    declare team?: EMatchCostTeam;
}

@Exclude()
export class MatchCostTeamScoreDto {
    @Expose()
    declare red: number;

    @Expose()
    declare blue: number;
}

@Exclude()
export class MatchCostGameDto {
    @Expose()
    declare id: number;

    @Expose()
    declare beatmapID: number;

    @Expose()
    @Type(() => Date)
    declare startedAt: Date;

    @Expose()
    @Type(() => MatchCostScoreDto)
    declare scores: Array<MatchCostScoreDto>;
}

@Exclude()
export class MatchCostMatchDto {
    @Expose()
    declare id: number;

    @Expose()
    declare type: EMatchCostTargetType;

    @Expose()
    declare name: string;

    @Expose()
    declare teamVs: boolean;

    @Expose()
    @Type(() => MatchCostUserDto)
    declare users: Array<MatchCostUserDto>;

    @Expose()
    @Type(() => MatchCostGameDto)
    declare games: Array<MatchCostGameDto>;

    @Expose()
    declare ended: boolean;
}

@Exclude()
export class MatchCostPlayerResultDto {
    @Expose()
    declare userID: number;

    @Expose()
    declare username: string;

    @Expose()
    declare countryCode: string;

    @Expose()
    declare matchCost: number;

    @Expose()
    declare gamesPlayed: number;

    @Expose()
    declare team?: EMatchCostTeam;
}

@Exclude()
export class MatchCostCalculationDto {
    @Expose()
    declare teamVs: boolean;

    @Expose()
    declare gamesPlayed: number;

    @Expose()
    @Type(() => MatchCostPlayerResultDto)
    declare players: Array<MatchCostPlayerResultDto>;

    @Expose()
    @Type(() => MatchCostTeamScoreDto)
    declare teamScore?: MatchCostTeamScoreDto;
}
