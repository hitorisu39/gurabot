import { Exclude, Expose } from "class-transformer";
import { PopulatedUser } from "./Profile.dto";

@Exclude()
export class BwsViewDto {
    @Expose()
    declare profile: PopulatedUser;

    @Expose()
    declare bws: number;

    @Expose()
    declare badgeCount: number;

    @Expose()
    declare nextBws: number;

    @Expose()
    declare custom: boolean;
}
