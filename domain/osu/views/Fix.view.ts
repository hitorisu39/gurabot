import { PopulatedUser } from "@domain/osu/Profile.dto";
import { PopulatedScore } from "@domain/osu/Score.dto";
import { SimulateStatisticsDto } from "@domain/osu/views/Simulate.view";
import { Score } from "@generated/adapter/types";
import { Exclude, Expose, Type } from "class-transformer";

@Exclude()
export class FixViewDto {
    @Expose()
    declare timestamp: number;

    @Expose()
    declare authorID: string;

    @Expose()
    @Type(() => PopulatedUser)
    declare profile: PopulatedUser;

    @Expose()
    @Type(() => PopulatedScore)
    declare sourceScore: PopulatedScore;

    @Expose()
    @Type(() => Score)
    declare topScores: Array<Score>;

    @Expose()
    declare proposedAccuracy: number;

    @Expose()
    declare accuracy?: number;

    @Expose()
    declare combo?: number;

    @Expose()
    @Type(() => SimulateStatisticsDto)
    declare statistics: SimulateStatisticsDto;
}
