import { Exclude, Expose, Type } from "class-transformer";
import { PopulatedUser } from "../Profile.dto";
import { OsekaiMedalDto } from "@domain/osekai/OsekaiMedal.dto";

@Exclude()
export class MedalStatsViewDto {
    @Expose()
    @Type(() => PopulatedUser)
    declare profile: PopulatedUser;

    @Expose()
    @Type(() => OsekaiMedalDto)
    declare medals: Array<OsekaiMedalDto>;
}
