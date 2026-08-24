import { Exclude, Expose, Type } from "class-transformer";
import { SnipeRecentDto } from "../SnipeRecent.dto";
import { ESnipePlayerChangeType } from "../enums/Snipe.enum";
import { PopulatedUser } from "@domain/osu/Profile.dto";

@Exclude()
export class SnipePlayerChangesViewDto {
    @Expose()
    declare timestamp: number;

    @Expose()
    declare authorID: string;

    @Expose()
    declare profile: PopulatedUser;

    @Expose()
    declare type: ESnipePlayerChangeType;

    @Expose()
    declare days: number;

    @Expose()
    declare page: number;

    @Expose()
    @Type(() => SnipeRecentDto)
    declare changes: Array<SnipeRecentDto>;
}
