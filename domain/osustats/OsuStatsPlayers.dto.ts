import { Exclude, Expose, Type } from "class-transformer";

@Exclude()
export class OsuStatsPlayerDto {
    @Expose()
    declare rank: number;

    @Expose()
    declare userID: number;

    @Expose()
    declare username: string;

    @Expose()
    declare count: number;
}

@Exclude()
export class OsuStatsPlayersPageDto {
    @Expose()
    @Type(() => OsuStatsPlayerDto)
    declare players: Array<OsuStatsPlayerDto>;
}
