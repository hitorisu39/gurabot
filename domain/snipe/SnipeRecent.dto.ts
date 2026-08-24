import { Exclude, Expose, Transform, Type } from "class-transformer";
import { transformAccuracy, transformMods } from "./Snipe.transform";
import { SerializableDto } from "@domain/core/Data";

@Exclude()
export class SnipeRecentDto extends SerializableDto {
    @Expose({ name: "map_id" })
    declare mapID: number;

    @Expose({ name: "player_id" })
    declare userID: number;

    @Expose()
    declare pp: number | null;

    @Expose({ name: "sr" })
    declare stars: number | null;

    @Expose()
    @Transform(transformAccuracy)
    declare accuracy: number;

    @Expose({ name: "date_set" })
    @Type(() => Date)
    declare date: Date | null;

    @Expose()
    @Transform(transformMods)
    declare mods: string | null;

    @Expose({ name: "max_combo" })
    declare maxCombo: number | null;

    @Expose()
    declare artist: string;

    @Expose()
    declare title: string;

    @Expose({ name: "diff_name" })
    declare version: string;

    @Expose({ name: "sniper_name" })
    declare sniperUsername?: string;

    @Expose({ name: "sniper_id" })
    declare sniperID: number;

    @Expose({ name: "sniped_name" })
    declare snipedUsername?: string;

    @Expose({ name: "sniped_id" })
    declare snipedID?: number;
}

@Exclude()
export class SnipeRecentChangesDto extends SerializableDto {
    @Expose()
    @Type(() => SnipeRecentDto)
    declare changes: Array<SnipeRecentDto>;
}
