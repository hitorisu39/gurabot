import { Exclude, Expose, Type } from "class-transformer";
import { EOtrRuleset } from "@domain/otr/enums/Otr.enum";
import { OtrLeaderboardPageDto } from "@domain/otr/OtrLeaderboard.dto";

@Exclude()
export class OtrLeaderboardViewDto {
    @Expose()
    declare timestamp: number;

    @Expose()
    declare authorID: string;

    @Expose()
    declare ruleset: EOtrRuleset;

    @Expose()
    declare country?: string;

    @Expose()
    declare page: number;

    @Expose()
    @Type(() => OtrLeaderboardPageDto)
    declare response: OtrLeaderboardPageDto | null;
}
