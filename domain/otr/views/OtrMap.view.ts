import { Exclude, Expose, Type } from "class-transformer";
import { Beatmapset } from "@generated/adapter/types";
import { OtrBeatmapStatsDto } from "@domain/otr/OtrBeatmap.dto";

export enum EOtrMapView {
    Overview = "Overview",
    Leaderboard = "Leaderboard",
    Tournaments = "Tournaments",
}

@Exclude()
export class OtrMapViewDto {
    @Expose()
    declare timestamp: number;

    @Expose()
    declare authorID: string;

    @Expose()
    @Type(() => Beatmapset)
    declare beatmapset: Beatmapset;

    @Expose()
    declare beatmapID: number;

    @Expose()
    @Type(() => OtrBeatmapStatsDto)
    declare stats: OtrBeatmapStatsDto;

    @Expose()
    declare leaderboardPage: number;

    @Expose()
    declare tournamentsPage: number;
}
