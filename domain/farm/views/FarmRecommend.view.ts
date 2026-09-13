import { Exclude, Expose, Type } from "class-transformer";
import type { IFarmMapQuery } from "../Farm.types";
import { PopulatedUser } from "@domain/osu/Profile.dto";
import { FarmRecommendationDto } from "../FarmRecommend.dto";

@Exclude()
export class FarmRecommendViewDto {
    @Expose()
    declare timestamp: number;

    @Expose()
    declare authorID: string;

    @Expose()
    @Type(() => PopulatedUser)
    declare profile: PopulatedUser;

    /**
     * Fully resolved query.
     */
    @Expose()
    declare query: IFarmMapQuery;

    @Expose()
    @Type(() => FarmRecommendationDto)
    declare recommendations: Array<FarmRecommendationDto>;
}
