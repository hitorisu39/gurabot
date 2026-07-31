import { ParsedMod } from "@generated/adapter/mods";
import { Beatmapset } from "@generated/adapter/types";
import { Exclude, Expose, Type } from "class-transformer";
import { ESimulateScoringMode } from "../enums/Simulate.enum";

@Exclude()
export class SimulateAttributeOverridesDto {
    @Expose()
    declare cs?: number;

    @Expose()
    declare ar?: number;

    @Expose()
    declare od?: number;

    @Expose()
    declare hp?: number;
}

@Exclude()
export class SimulateStatisticsDto {
    @Expose()
    declare count300?: number;

    @Expose()
    declare count100?: number;

    @Expose()
    declare count50?: number;

    /**
     * Mania perfects.
     */
    @Expose()
    declare countGeki?: number;

    /**
     * Mania goods, or catch tiny-droplet misses.
     */
    @Expose()
    declare countKatu?: number;

    @Expose()
    declare countMiss?: number;

    @Expose()
    declare countLargeTickMisses?: number;

    @Expose()
    declare countSliderTailMisses?: number;
}

@Exclude()
export class SimulateViewDto {
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
    declare mods: Array<ParsedMod>;

    @Expose()
    declare scoringMode: ESimulateScoringMode;

    @Expose()
    declare accuracy?: number;

    @Expose()
    declare combo?: number;

    @Expose()
    declare clockRate?: number;

    @Expose()
    @Type(() => SimulateAttributeOverridesDto)
    declare attributes: SimulateAttributeOverridesDto;

    @Expose()
    @Type(() => SimulateStatisticsDto)
    declare statistics: SimulateStatisticsDto;

    @Expose()
    declare legacyTotalScore?: number;
}
