import { Exclude, Expose, Type } from "class-transformer";

import { GameMode } from "@generated/adapter/types";
import { ESortOrder } from "@domain/osu/enums/Score.enum";
import { EOsuStatsBestSort, EOsuStatsBestTimeframe } from "../enums/OsuStatsBest.enum";
import { OsuStatsBestScoreDto } from "../OsuStatsBest.dto";

@Exclude()
export class OsuStatsBestViewDto {
    @Expose()
    declare authorID: string;

    @Expose()
    declare mode: GameMode;

    @Expose()
    declare timeframe: EOsuStatsBestTimeframe;

    @Expose()
    declare sort: EOsuStatsBestSort;

    @Expose()
    declare order: ESortOrder;

    @Expose()
    @Type(() => Date)
    declare startDate: Date;

    @Expose()
    @Type(() => Date)
    declare endDate: Date;

    @Expose()
    @Type(() => OsuStatsBestScoreDto)
    declare scores: Array<OsuStatsBestScoreDto>;

    @Expose()
    declare page: number;
}
