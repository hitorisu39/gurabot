import { Exclude, Expose } from "class-transformer";

@Exclude()
export class OsuToTwitchDto {
    @Expose()
    declare osuID: number;

    @Expose()
    declare twitchID: string;

    @Expose()
    declare createdAt: Date;

    @Expose()
    declare updatedAt: Date;
}
