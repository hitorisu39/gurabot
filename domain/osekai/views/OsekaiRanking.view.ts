import { Exclude, Expose, Type } from "class-transformer";
import { EOsekaiRanking } from "../enums/OsekaiRanking.enum";
import { OsekaiRankingEntryDto } from "../OsekaiRanking.dto";

@Exclude()
export class OsekaiRankingViewDto {
    @Expose()
    declare authorID: string;

    @Expose()
    declare ranking: EOsekaiRanking;

    @Expose()
    declare page: number;

    @Expose()
    declare total: number;

    @Expose()
    @Type(() => OsekaiRankingEntryDto)
    declare entries: Array<OsekaiRankingEntryDto>;

    @Expose()
    declare country?: string;
}
