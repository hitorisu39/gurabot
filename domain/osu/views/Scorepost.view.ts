import { PopulatedScore } from "@domain/osu/Score.dto";
import { EScorepostClient } from "@domain/osu/enums/Scorepost.enum";
import { User } from "@generated/adapter/types";
import { Exclude, Expose, Type } from "class-transformer";

@Exclude()
export class ScorepostViewDto {
    @Expose()
    @Type(() => PopulatedScore)
    declare score: PopulatedScore;

    @Expose()
    @Type(() => User)
    declare user: User;

    @Expose()
    declare client: EScorepostClient;

    @Expose()
    declare ur?: number | null;

    @Expose()
    declare text?: string | null;

    @Expose()
    declare timezoneOffset: number;
}
