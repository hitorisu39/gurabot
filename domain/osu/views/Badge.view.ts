import { Exclude, Expose, Type } from "class-transformer";
import { OsekaiBadgeDto } from "@domain/osekai/OsekaiBadge.dto";

@Exclude()
export class BadgeViewDto {
    @Expose()
    declare authorID: string;

    @Expose()
    @Type(() => OsekaiBadgeDto)
    declare badges: Array<OsekaiBadgeDto>;

    @Expose()
    declare page: number;

    @Expose()
    declare content?: string | null;
}
