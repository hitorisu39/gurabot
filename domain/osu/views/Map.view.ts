import { ParsedMod } from "@generated/adapter/mods";
import { Beatmapset } from "@generated/adapter/types";
import { Exclude, Expose, Type } from "class-transformer";

@Exclude()
export class MapViewDto {
    @Expose()
    declare timestamp: number;

    @Expose()
    declare authorID: string;

    @Expose()
    @Type(() => Beatmapset)
    declare beatmapset: Beatmapset;

    @Expose()
    declare beatmapID: number;

    @Expose()
    declare mods: Array<ParsedMod>;
}
