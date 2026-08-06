import { PopulatedUser } from "@domain/osu/Profile.dto";
import { NoChokeScore } from "@domain/osu/NoChoke.dto";
import { Exclude, Expose, Type } from "class-transformer";

@Exclude()
export class NoChokeViewDto {
    @Expose()
    declare timestamp: number;

    @Expose()
    declare authorID: string;

    @Expose()
    @Type(() => PopulatedUser)
    declare profile: PopulatedUser;

    @Expose()
    @Type(() => NoChokeScore)
    declare scores: Array<NoChokeScore>;

    @Expose()
    declare originalTotalPP: number;

    @Expose()
    declare projectedTotalPP: number;

    @Expose()
    declare maximumMisses: number | null;

    @Expose()
    declare page: number;
}
