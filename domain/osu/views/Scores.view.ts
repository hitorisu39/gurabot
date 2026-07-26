import { PopulatedUser } from "../Profile.dto";
import { Exclude, Expose, Type } from "class-transformer";
import { EScoreListSize, EScoreViewLayout } from "../enums/Score.enum";
import { PopulatedScore, ScoreWithPlacement } from "../Score.dto";

@Exclude()
export class ScoresViewDto {
    @Expose()
    declare timestamp: number;

    @Expose()
    declare authorID: string;

    @Expose()
    @Type(() => PopulatedUser)
    declare profile: PopulatedUser;

    @Expose()
    @Type(() => PopulatedScore)
    declare scores: Array<ScoreWithPlacement>;

    @Expose()
    declare displayQuery: string | null;

    @Expose()
    declare activeAttributes: Array<string>;

    @Expose()
    declare page: number;

    @Expose()
    declare pageSize: EScoreListSize;

    @Expose()
    declare layout?: EScoreViewLayout;
}
