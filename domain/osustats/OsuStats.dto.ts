import { Exclude, Expose, Type } from "class-transformer";

@Exclude()
export class OsuStatsErrorFieldsDto {
    @Expose()
    declare r?: Array<unknown>;
}

@Exclude()
export class OsuStatsErrorResponseDto {
    @Expose()
    @Type(() => OsuStatsErrorFieldsDto)
    declare errors?: OsuStatsErrorFieldsDto;
}
