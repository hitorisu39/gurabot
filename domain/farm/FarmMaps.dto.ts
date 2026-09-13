import { Exclude, Expose, Type } from "class-transformer";

@Exclude()
export class FarmMapsMapDto {
    @Expose()
    declare beatmapID: number;

    @Expose()
    declare mapsetID: number;

    @Expose()
    declare artist: string;

    @Expose()
    declare title: string;

    @Expose()
    declare version: string;

    @Expose()
    declare mods: number;

    @Expose()
    declare pp?: number | null;

    @Expose()
    declare farmability: number;

    @Expose()
    declare stars: number;

    @Expose()
    declare ar: number;

    @Expose()
    declare cs: number;

    @Expose()
    declare od: number;

    @Expose()
    declare hp: number;

    @Expose()
    declare bpm: number;

    @Expose()
    declare length: number;

    @Expose()
    @Type(() => Date)
    declare rankedAt: Date;
}
