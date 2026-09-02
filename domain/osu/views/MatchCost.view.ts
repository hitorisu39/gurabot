import { Exclude, Expose, Type } from "class-transformer";
import { MatchCostCalculationDto } from "@domain/osu/MatchCost.dto";
import { EMatchCostTargetType } from "../enums/MatchCost.enum";

@Exclude()
export class MatchCostViewDto {
    @Expose()
    declare id: number;

    @Expose()
    declare type: EMatchCostTargetType;

    @Expose()
    declare name: string;

    @Expose()
    declare ended: boolean;

    @Expose()
    declare warmups: number;

    @Expose()
    declare skip: number;

    @Expose()
    declare ezMultiplier: number;

    @Expose()
    @Type(() => MatchCostCalculationDto)
    declare calculation: MatchCostCalculationDto;
}
