import { Exclude, Expose, Type } from "class-transformer";
import { PopulatedUser } from "../Profile.dto";
import { PpTargetCalculationDto, RankPpResolutionDto } from "../Reach.dto";

@Exclude()
export class PpTargetViewDataDto {
    @Expose()
    @Type(() => PopulatedUser)
    declare profile: PopulatedUser;

    @Expose()
    declare targetPP: number;

    @Expose()
    @Type(() => RankPpResolutionDto)
    declare rankResolution?: RankPpResolutionDto;

    @Expose()
    @Type(() => PpTargetCalculationDto)
    declare calculation: PpTargetCalculationDto;
}
