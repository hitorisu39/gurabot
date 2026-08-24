import { SnipeCountryStatisticsDto } from "@domain/snipe/SnipeCountry.dto";
import { SnipeRankingPlayerDto } from "@domain/snipe/SnipeRanking.dto";
import { Expose, Type } from "class-transformer";

export class SnipeCountryStatsViewDto {
    @Expose()
    declare country: string;

    @Expose()
    @Type(() => SnipeCountryStatisticsDto)
    declare statistics: SnipeCountryStatisticsDto;

    @Expose()
    @Type(() => SnipeRankingPlayerDto)
    declare players: Array<SnipeRankingPlayerDto>;
}
