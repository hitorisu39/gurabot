import { Exclude, Expose, Type } from "class-transformer";
import { PopulatedUser } from "../Profile.dto";

@Exclude()
export class WhatIfViewDataDto {
    @Expose()
    declare timestamp: number;

    @Expose()
    @Type(() => PopulatedUser)
    declare profile: PopulatedUser;

    @Expose()
    declare playPP: number;

    @Expose()
    declare placement: number;

    @Expose()
    declare currentPP: number;

    @Expose()
    declare projectedPP: number;

    @Expose()
    declare ppDifference: number;

    @Expose()
    declare currentRank: number;

    @Expose()
    declare projectedRank?: number;
}
