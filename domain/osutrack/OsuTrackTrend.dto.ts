import { Exclude, Expose } from "class-transformer";
import { EOsuTrackTrendConfidence } from "./enums/OsuTrackTrend.enum";

@Exclude()
export class OsuTrackPpTrendDto {
    @Expose()
    declare ppPerDay: number;

    @Expose()
    declare ppPerMonth: number;

    @Expose()
    declare sampleCount: number;

    @Expose()
    declare spanDays: number;

    @Expose()
    declare firstDate: Date;

    @Expose()
    declare latestDate: Date;

    @Expose()
    declare confidence: EOsuTrackTrendConfidence;
}
