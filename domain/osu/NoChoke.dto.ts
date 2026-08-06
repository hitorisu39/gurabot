import { Grade } from "@generated/adapter/types";
import { Exclude, Expose, Type } from "class-transformer";
import { PopulatedScore } from "./Score.dto";

@Exclude()
export class NoChokeProjectionDto {
    @Expose()
    declare applied: boolean;

    @Expose()
    declare originalIndex: number;

    @Expose()
    declare projectedIndex: number;

    @Expose()
    declare originalMisses: number;

    @Expose()
    declare removedMisses: number;

    @Expose()
    declare originalPP: number;

    @Expose()
    declare projectedPP: number;

    @Expose()
    declare originalAccuracy: number;

    @Expose()
    declare projectedAccuracy: number;

    @Expose()
    declare originalCombo: number;

    @Expose()
    declare projectedCombo: number;

    @Expose()
    declare originalGrade: Grade;

    @Expose()
    declare projectedGrade: Grade;
}

@Exclude()
export class NoChokeScore extends PopulatedScore {
    @Expose()
    @Type(() => NoChokeProjectionDto)
    declare noChoke: NoChokeProjectionDto;
}
