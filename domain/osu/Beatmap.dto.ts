import { Beatmap } from "@generated/adapter/types";
import { Exclude, Expose } from "class-transformer";

@Exclude()
export class MatchedMapDto {
    @Expose()
    declare beatmapID: number | null;

    @Expose()
    declare beatmapsetID: number | null;
}

@Exclude()
export class ResolvedBeatmapDto extends MatchedMapDto {
    @Expose()
    declare beatmap: Beatmap;
}
