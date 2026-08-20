import { Exclude, Expose, Type } from "class-transformer";

@Exclude()
export class OsuStatsCountEntryDto {
    @Expose()
    declare rank: number;

    @Expose()
    declare count: number;
}

@Exclude()
export class OsuStatsCountsDto {
    @Expose()
    @Type(() => OsuStatsCountEntryDto)
    declare entries: Array<OsuStatsCountEntryDto>;
}
