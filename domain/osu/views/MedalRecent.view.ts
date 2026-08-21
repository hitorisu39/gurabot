import { Exclude, Expose, Type } from "class-transformer";
import { PopulatedUser } from "../Profile.dto";
import { OsekaiMedalDto } from "@domain/osekai/OsekaiMedal.dto";

@Exclude()
export class MedalRecentEntryDto {
    @Expose()
    @Type(() => OsekaiMedalDto)
    declare medal: OsekaiMedalDto;

    @Expose()
    @Type(() => Date)
    declare achievedAt: Date;
}

@Exclude()
export class MedalRecentViewDto {
    @Expose()
    declare timestamp: number;

    @Expose()
    declare authorID: string;

    @Expose()
    @Type(() => PopulatedUser)
    declare profile: PopulatedUser;

    @Expose()
    @Type(() => MedalRecentEntryDto)
    declare medals: Array<MedalRecentEntryDto>;

    @Expose()
    declare page: number;

    @Expose()
    declare spoil: boolean;
}
