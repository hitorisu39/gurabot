import { Exclude, Expose, Type } from "class-transformer";
import { PopulatedUser } from "@domain/osu/Profile.dto";
import { OtrPlayerStatsDto, OtrPlayerTournamentDto } from "@domain/otr/OtrPlayer.dto";

export enum EOtrProfileView {
    Overview = "Overview",
    Performance = "Performance",
    Form = "Form",
    Mods = "Mods",
    Connections = "Connections",
    Tournaments = "Tournaments",
}

export enum EOtrFormPeriod {
    Days30 = "30d",
    Days90 = "90d",
    Months6 = "6m",
    Year1 = "1y",
    All = "all",
}

@Exclude()
export class OtrProfileViewDto {
    @Expose()
    declare timestamp: number;

    @Expose()
    declare authorID: string;

    @Expose()
    @Type(() => PopulatedUser)
    declare profile: PopulatedUser;

    @Expose()
    @Type(() => OtrPlayerStatsDto)
    declare stats: OtrPlayerStatsDto;

    @Expose()
    @Type(() => OtrPlayerTournamentDto)
    declare tournaments: Array<OtrPlayerTournamentDto> | null;

    @Expose()
    @Type(() => OtrPlayerStatsDto)
    declare formStats: OtrPlayerStatsDto | null;

    @Expose()
    declare formPeriod: EOtrFormPeriod;
}
