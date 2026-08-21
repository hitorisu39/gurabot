import { PopulatedScore } from "./Score.dto";
import { ParsedMod } from "@generated/adapter/mods";
import { Exclude, Expose, Type } from "class-transformer";

@Exclude()
export class TopIfProjectionDto {
    @Expose()
    declare originalIndex: number;

    @Expose()
    declare projectedIndex: number;

    @Expose()
    declare originalPP: number;

    @Expose()
    declare originalMods: Array<ParsedMod>;
}

@Exclude()
export class TopIfScore extends PopulatedScore {
    @Expose()
    @Type(() => TopIfProjectionDto)
    declare topIf: TopIfProjectionDto;
}
