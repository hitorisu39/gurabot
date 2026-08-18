import { Exclude, Expose, Type } from "class-transformer";
import { OsekaiMedalBeatmapDto, OsekaiMedalCommentDto, OsekaiMedalDto } from "@domain/osekai/OsekaiMedal.dto";

@Exclude()
export class MedalInfoViewDto {
    @Expose()
    @Type(() => OsekaiMedalDto)
    declare medal: OsekaiMedalDto;

    @Expose()
    @Type(() => OsekaiMedalBeatmapDto)
    declare beatmaps: Array<OsekaiMedalBeatmapDto>;

    @Expose()
    @Type(() => OsekaiMedalCommentDto)
    declare comments: Array<OsekaiMedalCommentDto>;

    @Expose()
    declare spoil: boolean;
}
