import { SerializableDto } from "@domain/core/Data";
import { Exclude, Expose, Transform, Type } from "class-transformer";
import { transformAccuracy } from "./Snipe.transform";

@Exclude()
export class SnipeScoreBeatmapDto extends SerializableDto {
    @Expose({ name: "map_id" })
    declare mapID: number;
}

@Exclude()
export class SnipeScoreDto extends SerializableDto {
    @Expose()
    declare score: number;

    @Expose()
    declare pp: number | null;

    @Expose({ name: "sr" })
    declare stars: number;

    @Expose()
    @Transform(transformAccuracy)
    declare accuracy: number;

    @Expose({ name: "count_miss" })
    declare misses: number | null;

    @Expose({ name: "date_set" })
    @Type(() => Date)
    declare date: Date | null;

    @Expose()
    @Transform(
        ({ value }) => {
            if (!value || value === "nomod") return "NM";
            return String(value).toUpperCase();
        },
        { toClassOnly: true },
    )
    declare mods: string;

    @Expose({ name: "max_combo" })
    declare maxCombo: number | null;

    @Expose()
    @Type(() => SnipeScoreBeatmapDto)
    declare beatmap: SnipeScoreBeatmapDto;
}

@Exclude()
export class SnipeScoresDto extends SerializableDto {
    @Expose()
    @Type(() => SnipeScoreDto)
    declare scores: Array<SnipeScoreDto>;
}
