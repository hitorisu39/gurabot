import { Beatmap } from "@generated/adapter/types";
import { PopulatedUser } from "../Profile.dto";
import { Exclude, Expose, Type } from "class-transformer";

@Exclude()
export class CommonTopComparisonDto {
    @Expose()
    declare beatmapID: number;

    @Expose()
    declare leftPP: number;

    @Expose()
    declare rightPP: number;

    @Expose()
    @Type(() => Beatmap)
    declare beatmap: Beatmap;
}

@Exclude()
export class CompareTopViewDto {
    @Expose()
    declare timestamp: number;

    @Expose()
    declare authorID: string;

    @Expose()
    @Type(() => PopulatedUser)
    declare left: PopulatedUser;

    @Expose()
    @Type(() => PopulatedUser)
    declare right: PopulatedUser;

    @Expose()
    @Type(() => CommonTopComparisonDto)
    declare comparisons: Array<CommonTopComparisonDto>;

    @Expose()
    declare page: number;
}
