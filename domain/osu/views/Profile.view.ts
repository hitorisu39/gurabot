import { GameMode } from "@generated/adapter/types";
import { PopulatedScore, ScoreWithMaps } from "../Score.dto";
import { PopulatedUser } from "../Profile.dto";
import { Exclude, Expose, Type } from "class-transformer";
import { AmeobeaPeakDto } from "@domain/ameobea/Ameobea.dto";

export enum EProfileView {
    Overview = "Overview",
    Statistics = "Statistics",
    Average = "Average",
    Mods = "Mods",
    Daily = "Daily",
    Mapper = "Mapper",
}

@Exclude()
export class ProfileViewDto {
    @Expose()
    declare origin: string;

    @Expose()
    declare authorID: string;

    @Expose()
    @Type(() => PopulatedUser)
    declare profile: PopulatedUser;

    @Expose()
    @Type(() => ScoreWithMaps)
    declare scores: Array<ScoreWithMaps> | null;

    @Expose()
    @Type(() => PopulatedScore)
    declare populated: Array<PopulatedScore<GameMode>> | null;

    @Expose()
    @Type(() => AmeobeaPeakDto)
    declare ameobea: AmeobeaPeakDto | null;

    @Expose()
    declare timestamp: number;
}
