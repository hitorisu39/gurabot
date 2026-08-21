import { Exclude, Expose, Type } from "class-transformer";
import { PopulatedUser } from "../Profile.dto";
import { OsekaiMedalDto } from "@domain/osekai/OsekaiMedal.dto";
import { EMedalCollectionSort } from "../enums/Medal.enum";
import { GameMode } from "@generated/adapter/types";

@Exclude()
export class MedalMissingViewDto {
    @Expose()
    declare timestamp: number;

    @Expose()
    declare authorID: string;

    @Expose()
    @Type(() => PopulatedUser)
    declare profile: PopulatedUser;

    @Expose()
    @Type(() => OsekaiMedalDto)
    declare medals: Array<OsekaiMedalDto>;

    /**
     * Total number of medals in the currently selected scope,
     * before removing achieved medals.
     */
    @Expose()
    declare totalMedals: number;

    @Expose()
    declare page: number;

    @Expose()
    declare sort: EMedalCollectionSort;

    @Expose()
    declare group: string | null;

    @Expose()
    declare mode: GameMode | null;
}
