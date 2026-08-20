import { Exclude, Expose, Type } from "class-transformer";
import { IOsekaiCompactData } from "./Osekai.dto";
import { EOsekaiRankingEntryType, EOsekaiRankingValueFormat } from "./enums/OsekaiRanking.enum";

export interface IOsekaiRankingResponse {
    data: IOsekaiCompactData;
    max: number;
}

@Exclude()
export class OsekaiRankingMetaDto {
    @Expose()
    declare type: string;

    @Expose()
    declare optionType?: string;

    @Expose()
    declare title: string;

    @Expose()
    declare url: string;

    @Expose()
    declare valueField: string;

    @Expose()
    declare valueFormat: EOsekaiRankingValueFormat;

    @Expose()
    declare entryType: EOsekaiRankingEntryType;
}

@Exclude()
export class OsekaiRankingEntryDto {
    @Expose()
    declare rank: number;

    @Expose()
    declare name: string;

    @Expose()
    declare value: number;

    @Expose()
    declare userID?: number;

    @Expose()
    declare countryCode?: string;
}

@Exclude()
export class OsekaiRankingPageDto {
    @Expose()
    @Type(() => OsekaiRankingEntryDto)
    declare entries: Array<OsekaiRankingEntryDto>;

    @Expose()
    declare total: number;
}
