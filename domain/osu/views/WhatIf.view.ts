import { Exclude } from "class-transformer";
import { PopulatedUser } from "../Profile.dto";

@Exclude()
export class WhatIfViewDataDto {
    declare timestamp: number;
    declare profile: PopulatedUser;

    declare playPP: number;
    declare placement: number;

    declare currentPP: number;
    declare projectedPP: number;
    declare ppDifference: number;

    declare currentRank: number;
    declare projectedRank?: number;
}
