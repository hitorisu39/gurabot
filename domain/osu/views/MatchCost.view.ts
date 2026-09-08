import { Exclude, Expose, Type } from "class-transformer";
import { MatchCostCalculationDto } from "@domain/osu/MatchCost.dto";
import { EMultiplayerTargetType } from "../enums/Multiplayer.enum";

@Exclude()
export class MatchCostViewDto {
    @Expose()
    declare id: number;

    @Expose()
    declare type: EMultiplayerTargetType;

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
