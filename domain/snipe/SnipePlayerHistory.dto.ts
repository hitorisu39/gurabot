import { SerializableDto } from "@domain/core/Data";
import { Exclude, Expose, Type } from "class-transformer";

@Exclude()
export class SnipePlayerHistoryEntryDto extends SerializableDto {
    @Expose({ name: "history_date" })
    declare date: string;

    @Expose({ name: "count_total" })
    declare count: number;
}

@Exclude()
export class SnipePlayerHistoryDto extends SerializableDto {
    @Expose()
    @Type(() => SnipePlayerHistoryEntryDto)
    declare entries: Array<SnipePlayerHistoryEntryDto>;
}
