import { ESnipeRankingSort } from "@domain/snipe/enums/Snipe.enum";
import { SnipeRankingPlayerDto } from "@domain/snipe/SnipeRanking.dto";

import { Exclude, Expose, Type } from "class-transformer";

@Exclude()
export class SnipeRankingViewDto {
    @Expose()
    declare authorID: string;

    @Expose()
    declare country: string;

    @Expose()
    declare sort: ESnipeRankingSort;

    @Expose()
    declare page: number;

    @Expose()
    @Type(() => SnipeRankingPlayerDto)
    declare players: Array<SnipeRankingPlayerDto>;
}
