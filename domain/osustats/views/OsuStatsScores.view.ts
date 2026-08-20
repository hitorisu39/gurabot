import { Exclude, Expose, Type } from "class-transformer";
import { PopulatedUser } from "@domain/osu/Profile.dto";
import { PopulatedScore } from "@domain/osu/Score.dto";
import { EScoreListSize } from "@domain/osu/enums/Score.enum";
import { OsuStatsScoresRequestDto } from "../OsuStatsScores.dto";

@Exclude()
export class OsuStatsScoresViewDto {
    @Expose()
    declare timestamp: number;

    @Expose()
    declare authorID: string;

    @Expose()
    @Type(() => PopulatedUser)
    declare profile: PopulatedUser;

    @Expose()
    @Type(() => PopulatedScore)
    declare scores: Array<PopulatedScore>;

    @Expose()
    @Type(() => OsuStatsScoresRequestDto)
    declare request: OsuStatsScoresRequestDto;

    @Expose()
    declare page: number;

    @Expose()
    declare total: number;

    @Expose()
    declare apiPageSize: number;

    @Expose()
    declare pageSize: EScoreListSize;
}
