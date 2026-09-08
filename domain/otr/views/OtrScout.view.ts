import { PopulatedUser } from "@domain/osu/Profile.dto";
import { OtrPlayerStatsDto } from "@domain/otr/OtrPlayer.dto";
import { Exclude, Expose, Type } from "class-transformer";
import { OtrScoutEventDto, OtrScoutMatchDto } from "../OtrScout.dto";

export enum EOtrScoutView {
    Overview = "Overview",
    Matches = "Matches",
    Events = "Events",
    Mods = "Mods",
}

@Exclude()
export class OtrScoutViewDto {
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
    @Type(() => OtrScoutMatchDto)
    declare matches: Array<OtrScoutMatchDto> | null;

    @Expose()
    @Type(() => OtrScoutEventDto)
    declare events: Array<OtrScoutEventDto> | null;

    @Expose()
    declare selectedMatchID: number | null;
}
