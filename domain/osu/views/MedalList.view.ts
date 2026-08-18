import { Exclude, Expose, Type } from "class-transformer";
import { PopulatedUser } from "../Profile.dto";
import { OsekaiMedalDto } from "@domain/osekai/OsekaiMedal.dto";
import { GameMode } from "@generated/adapter/types";
import { EMedalCollectionSort } from "../enums/Medal.enum";

@Exclude()
export class MedalListEntryDto {
    @Expose()
    @Type(() => OsekaiMedalDto)
    declare medal: OsekaiMedalDto;

    @Expose()
    @Type(() => Date)
    declare achievedAt: Date;
}

@Exclude()
export class MedalListViewDto {
    @Expose()
    declare authorID: string;

    @Expose()
    @Type(() => PopulatedUser)
    declare profile: PopulatedUser;

    @Expose()
    @Type(() => MedalListEntryDto)
    declare medals: Array<MedalListEntryDto>;

    /**
     * Number of medals applicable to the active filters.
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
