import { Exclude, Expose, Type } from "class-transformer";
import { SnipeScoreDto } from "../SnipeScore.dto";
import { ESnipePlayerListSort } from "../enums/Snipe.enum";
import { ESortOrder } from "@domain/osu/enums/Score.enum";
import { PopulatedUser } from "@domain/osu/Profile.dto";

@Exclude()
export class SnipePlayerListViewDto {
    @Expose()
    declare timestamp: number;

    @Expose()
    declare authorID: string;

    @Expose()
    declare profile: PopulatedUser;

    @Expose()
    declare sort: ESnipePlayerListSort;

    @Expose()
    declare order: ESortOrder;

    @Expose()
    declare mods?: string;

    @Expose()
    declare page: number;

    @Expose()
    declare apiPage: number;

    @Expose()
    declare total: number;

    @Expose()
    @Type(() => SnipeScoreDto)
    declare scores: Array<SnipeScoreDto>;
}
