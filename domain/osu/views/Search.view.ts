import { Beatmapset } from "@generated/adapter/types";
import { Exclude, Expose, Type } from "class-transformer";
import type { IBeatmapsetSearchInput } from "../Adapter.dto";

@Exclude()
export class SearchViewDto {
    @Expose()
    declare authorID: string;

    @Expose()
    declare input: IBeatmapsetSearchInput;

    @Expose()
    @Type(() => Beatmapset)
    declare beatmapsets: Array<Beatmapset>;

    @Expose()
    declare total: number;

    /**
     * Discord page
     */
    @Expose()
    declare page: number;

    @Expose()
    declare cursorString?: string;
}
