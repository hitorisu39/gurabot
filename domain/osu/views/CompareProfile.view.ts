import { Exclude, Expose, Type } from "class-transformer";
import { Score } from "@generated/adapter/types";
import { PopulatedUser } from "../Profile.dto";
import { PopulatedScore, ScoreWithMaps } from "../Score.dto";
import { OsuTrackPeakDto } from "@domain/osutrack/OsuTrack.dto";

export enum ECompareProfileView {
    Overview = "Overview",
    Performance = "Performance",
    Top100 = "Top100",
    Scores = "Scores",
    Matchmaking = "Matchmaking",
    Activity = "Activity",
    Mapping = "Mapping",
    Mods = "Mods",
    Daily = "Daily",
}

@Exclude()
export class CompareProfilePlayerDto {
    @Expose()
    @Type(() => PopulatedUser)
    declare profile: PopulatedUser;

    /**
     * Raw top scores.
     * These are stored immediately because a lot of comparison statistics
     * don't require beatmap/calculation population.
     */
    @Expose()
    @Type(() => Score)
    declare scores: Array<Score>;

    /**
     * Scores with beatmaps/mapsets.
     * Populated lazily when a view needs map information.
     */
    @Expose()
    @Type(() => ScoreWithMaps)
    declare mapped: Array<ScoreWithMaps> | null;

    /**
     * Fully calculated scores.
     * Populated lazily only for the Top 100 view.
     */
    @Expose()
    @Type(() => PopulatedScore)
    declare populated: Array<PopulatedScore> | null;

    @Expose()
    @Type(() => OsuTrackPeakDto)
    declare osutrack: OsuTrackPeakDto | null;
}

@Exclude()
export class CompareProfileViewDto {
    @Expose()
    declare origin: string;

    @Expose()
    declare authorID: string;

    @Expose()
    declare timestamp: number;

    @Expose()
    @Type(() => CompareProfilePlayerDto)
    declare left: CompareProfilePlayerDto;

    @Expose()
    @Type(() => CompareProfilePlayerDto)
    declare right: CompareProfilePlayerDto;
}
