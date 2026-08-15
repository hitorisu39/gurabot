import { Exclude, Expose, Type } from "class-transformer";
import { PopulatedUser } from "./Profile.dto";
import {
    EUsernameAvailabilityStatus,
    EUsernameProtectionReason,
    EUsernameValidationIssue,
} from "./enums/UsernameAvailability.enum";

@Exclude()
export class UsernameAvailabilityDto {
    @Expose()
    declare username: string;

    @Expose()
    declare status: EUsernameAvailabilityStatus;

    @Expose()
    declare validationIssues: Array<EUsernameValidationIssue>;

    @Expose()
    declare protectionReasons: Array<EUsernameProtectionReason>;

    @Expose()
    @Type(() => Date)
    declare availableAt?: Date;

    @Expose()
    @Type(() => Date)
    declare availableIfInactiveFromNow?: Date;

    @Expose()
    @Type(() => PopulatedUser)
    declare user?: PopulatedUser;
}
