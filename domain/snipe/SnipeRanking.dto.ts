import { SerializableDto } from "@domain/core/Data";
import { Exclude, Expose, Type } from "class-transformer";

@Exclude()
export class SnipeRankingPlayerDto extends SerializableDto {
    @Expose({ name: "user_id" })
    declare userID: number;

    @Expose()
    declare username: string;

    @Expose({ name: "average_pp" })
    declare averagePP: number | null;

    @Expose({ name: "average_sr" })
    declare averageStars: number;

    @Expose({ name: "weighted_pp" })
    declare weightedPP: number;

    @Expose({ name: "count_total" })
    declare firstPlaceCount: number;
}

@Exclude()
export class SnipeRankingDto extends SerializableDto {
    @Expose()
    @Type(() => SnipeRankingPlayerDto)
    declare players: Array<SnipeRankingPlayerDto>;
}
