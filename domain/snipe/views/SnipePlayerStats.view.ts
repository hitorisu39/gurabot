import { Expose, Type } from "class-transformer";
import { SnipePlayerDto } from "../SnipePlayer.dto";
import { SnipePlayerHistoryDto } from "../SnipePlayerHistory.dto";
import { PopulatedUser } from "@domain/osu/Profile.dto";

export class SnipePlayerStatsViewDto {
    @Expose()
    declare profile: PopulatedUser;

    @Expose()
    @Type(() => SnipePlayerDto)
    declare player: SnipePlayerDto;

    @Expose()
    @Type(() => SnipePlayerHistoryDto)
    declare history: SnipePlayerHistoryDto;
}
