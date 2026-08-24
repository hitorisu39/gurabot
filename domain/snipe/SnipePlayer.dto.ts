import { Exclude, Expose, Transform } from "class-transformer";
import { transformAccuracy, transformModCounts, transformStarRatingSpread } from "./Snipe.transform";
import { SerializableDto } from "@domain/core/Data";

@Exclude()
export class SnipePlayerDto extends SerializableDto {
    @Expose({ name: "user_id" })
    declare userID: number;

    @Expose()
    declare username: string;

    @Expose({ name: "average_pp" })
    declare averagePP: number;

    @Expose({ name: "average_acc" })
    @Transform(transformAccuracy)
    declare averageAccuracy: number;

    @Expose({ name: "average_sr" })
    declare averageStars: number;

    @Expose({ name: "average_score" })
    declare averageScore: number;

    @Expose({ name: "count_total" })
    declare firstPlaceCount: number;

    @Expose({ name: "count_loved" })
    declare lovedFirstPlaceCount: number;

    @Expose({ name: "count_ranked" })
    declare rankedFirstPlaceCount: number;

    @Expose({ name: "recent_history_difference" })
    declare recentHistoryDifference: number;

    @Expose({ name: "mods_count" })
    @Transform(transformModCounts, { toClassOnly: true })
    declare modCounts: Record<string, number>;

    @Expose({ name: "sr_spread" })
    @Transform(transformStarRatingSpread, { toClassOnly: true })
    declare starRatingSpread: Record<string, number>;

    @Expose({ name: "oldest_date_map_id" })
    declare oldestMapID: number | null;
}
