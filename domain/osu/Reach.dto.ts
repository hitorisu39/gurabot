import { Exclude, Expose } from "class-transformer";
import { EPpTargetCalculationType, ERankPpResolutionSource } from "./enums/Reach.enum";

@Exclude()
export class RankPpResolutionHolderDto {
    @Expose()
    declare id: number;

    @Expose()
    declare username: string;
}

@Exclude()
export class RankPpResolutionDto {
    @Expose()
    declare rank: number;

    @Expose()
    declare countryCode?: string;

    @Expose()
    declare pp: number;

    @Expose()
    declare source: ERankPpResolutionSource;

    @Expose()
    declare holder?: RankPpResolutionHolderDto;
}

@Exclude()
export class PpTargetRouteDto {
    @Expose()
    declare scores: Array<number>;

    @Expose()
    declare projectedPP: number;

    @Expose()
    declare ppDifference: number;
}

@Exclude()
export class PpTargetCalculationDto {
    @Expose()
    declare type: EPpTargetCalculationType;

    @Expose()
    declare primary: PpTargetRouteDto;

    @Expose()
    declare alternative?: PpTargetRouteDto;

    @Expose()
    declare topPlayPP?: number;

    @Expose()
    declare alternativeUnavailable?: boolean;
}
