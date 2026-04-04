import { Exclude, Expose } from "class-transformer";

@Exclude()
export class MatchedMapDto {
    @Expose()
    declare beatmapID: number | null;

    @Expose()
    declare beatmapsetID: number | null;
}
