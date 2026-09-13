import { GameMode } from "@generated/adapter/types";
import { Exclude, Expose, Type } from "class-transformer";
import type { IFarmMapQuery } from "../Farm.types";
import { FarmMapsMapDto } from "../FarmMaps.dto";

@Exclude()
export class FarmMapsViewDto {
    @Expose()
    declare authorID: string;

    @Expose()
    declare mode: GameMode;

    @Expose()
    declare query: IFarmMapQuery;

    @Expose()
    @Type(() => FarmMapsMapDto)
    declare maps: Array<FarmMapsMapDto>;

    @Expose()
    declare page: number;

    @Expose()
    declare lastPage?: number;
}
