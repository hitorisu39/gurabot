import { PopulatedUser } from "@domain/osu/Profile.dto";
import { Exclude, Expose, Type } from "class-transformer";
import { OsuStatsCountsDto } from "../OsuStatsCounts.dto";

@Exclude()
export class OsuStatsCompareViewDto {
    @Expose()
    @Type(() => PopulatedUser)
    declare leftProfile: PopulatedUser;

    @Expose()
    @Type(() => PopulatedUser)
    declare rightProfile: PopulatedUser;

    @Expose()
    @Type(() => OsuStatsCountsDto)
    declare leftCounts: OsuStatsCountsDto;

    @Expose()
    @Type(() => OsuStatsCountsDto)
    declare rightCounts: OsuStatsCountsDto;
}
