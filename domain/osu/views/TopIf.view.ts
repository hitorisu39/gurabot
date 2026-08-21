import { PopulatedUser } from "@domain/osu/Profile.dto";
import { TopIfScore } from "@domain/osu/TopIf.dto";
import { ICommandMods } from "@domain/core/Command";
import { Exclude, Expose, Type } from "class-transformer";

@Exclude()
export class TopIfViewDto {
    @Expose()
    declare timestamp: number;

    @Expose()
    declare authorID: string;

    @Expose()
    @Type(() => PopulatedUser)
    declare profile: PopulatedUser;

    @Expose()
    @Type(() => TopIfScore)
    declare scores: Array<TopIfScore>;

    @Expose()
    declare operations: Array<ICommandMods>;

    @Expose()
    declare originalTotalPP: number;

    @Expose()
    declare projectedTotalPP: number;

    @Expose()
    declare page: number;
}
