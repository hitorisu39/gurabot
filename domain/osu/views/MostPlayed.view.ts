import { Exclude, Expose, Type } from "class-transformer";
import { BeatmapPlaycount } from "@generated/adapter/types";
import { PopulatedUser } from "../Profile.dto";

@Exclude()
export class MostPlayedViewDto {
    @Expose()
    declare timestamp: number;

    @Expose()
    declare authorID: string;

    @Expose()
    @Type(() => PopulatedUser)
    declare profile: PopulatedUser;

    @Expose()
    @Type(() => BeatmapPlaycount)
    declare beatmaps: Array<BeatmapPlaycount>;

    @Expose()
    declare page: number;
}
