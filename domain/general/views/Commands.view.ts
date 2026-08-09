import { ECommandCategory } from "@domain/core/Command";
import { Exclude, Expose } from "class-transformer";

@Exclude()
export class CommandsViewDto {
    @Expose()
    declare authorID: string;

    @Expose()
    declare category: ECommandCategory;
}
