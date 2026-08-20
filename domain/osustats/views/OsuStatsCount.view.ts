import { Exclude, Expose, Type } from "class-transformer";
import { PopulatedUser } from "@domain/osu/Profile.dto";
import { OsuStatsCountsDto } from "../OsuStatsCounts.dto";

@Exclude()
export class OsuStatsCountViewDto {
    @Expose()
    @Type(() => PopulatedUser)
    declare profile: PopulatedUser;

    @Expose()
    @Type(() => OsuStatsCountsDto)
    declare counts: OsuStatsCountsDto;
}
