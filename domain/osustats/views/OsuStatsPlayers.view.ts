import { Exclude, Expose, Type } from "class-transformer";
import { GameMode } from "@generated/adapter/types";
import { OsuStatsPlayerDto } from "../OsuStatsPlayers.dto";

@Exclude()
export class OsuStatsPlayersViewDto {
    @Expose()
    declare authorID: string;

    @Expose()
    declare mode: GameMode;

    @Expose()
    declare country?: string;

    @Expose()
    declare minRank: number;

    @Expose()
    declare maxRank: number;

    @Expose()
    declare page: number;

    @Expose()
    declare lastPage?: number;

    @Expose()
    @Type(() => OsuStatsPlayerDto)
    declare players: Array<OsuStatsPlayerDto>;
}
