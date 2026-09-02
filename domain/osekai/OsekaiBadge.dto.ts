import { SerializableDto } from "@domain/core/Data";
import { Exclude, Expose, Transform, Type } from "class-transformer";
import { osekaiBadgeBase } from "./configs/OsekaiMedal.config";

function transformOsekaiDate(value: unknown): Date {
    if (value instanceof Date) {
        return value;
    }

    const raw = String(value);
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw) ? `${raw.replace(" ", "T")}Z` : raw;
    return new Date(normalized);
}

@Exclude()
export class OsekaiBadgeHolderDto extends SerializableDto {
    @Expose({ name: "User_ID" })
    @Type(() => Number)
    declare userID: number;

    @Expose({ name: "Username" })
    @Transform(({ value }) => String(value ?? ""))
    declare username: string;

    @Expose({ name: "Country_Code" })
    declare countryCode: string | null;
}

@Exclude()
export class OsekaiBadgeDto extends SerializableDto {
    @Expose({ name: "ID" })
    @Type(() => Number)
    declare id: number;

    @Expose({ name: "Name" })
    declare name: string;

    @Expose({ name: "Description" })
    declare description: string;

    @Expose({ name: "Image_URL" })
    declare imageURL: string;

    @Expose({ name: "First_Date_Awarded" })
    @Transform(({ value }) => transformOsekaiDate(value), {
        toClassOnly: true,
    })
    declare firstAwardedAt: Date;

    @Expose({ name: "Users" })
    @Type(() => OsekaiBadgeHolderDto)
    declare holders: Array<OsekaiBadgeHolderDto>;

    public url(): string {
        return `${osekaiBadgeBase}${encodeURIComponent(this.name)}`;
    }
}
