import { Exclude, Expose, Type } from "class-transformer";

import { PopulatedUser } from "@domain/osu/Profile.dto";
import { OtrPlayerStatsDto } from "@domain/otr/OtrPlayer.dto";

export enum EOtrCompareView {
    Overview = "Overview",
    Performance = "Performance",
    Mods = "Mods",
    Experience = "Experience",
    Matchup = "Matchup",
}

@Exclude()
export class OtrCompareViewDto {
    @Expose()
    declare authorID: string;

    @Expose()
    @Type(() => PopulatedUser)
    declare leftProfile: PopulatedUser;

    @Expose()
    @Type(() => PopulatedUser)
    declare rightProfile: PopulatedUser;

    @Expose()
    @Type(() => OtrPlayerStatsDto)
    declare leftStats: OtrPlayerStatsDto;

    @Expose()
    @Type(() => OtrPlayerStatsDto)
    declare rightStats: OtrPlayerStatsDto;
}
