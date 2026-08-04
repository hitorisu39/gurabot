import { Exclude, Expose, Type } from "class-transformer";
import { AdapterProvider, Beatmap, Score } from "@generated/adapter/types";
import { PopulatedScore } from "@domain/osu/Score.dto";

@Exclude()
export class LeaderboardViewDto {
    @Expose()
    declare timestamp: number;

    @Expose()
    declare authorID: string;

    @Expose()
    declare provider: AdapterProvider;

    @Expose()
    @Type(() => Beatmap)
    declare beatmap: Beatmap;

    @Expose()
    @Type(() => PopulatedScore)
    declare scores: Array<Score>;

    @Expose()
    declare starRating: number;

    @Expose()
    declare page: number;
}
