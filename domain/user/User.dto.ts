import { Exclude, Expose } from "class-transformer";
import { AdapterProvider, GameMode } from "@generated/adapter/types";
import { EScoreListSize } from "@domain/osu/enums/Score.enum";

@Exclude()
export class UserToOsuDto {
    @Expose()
    declare userID: string;

    @Expose()
    declare server: AdapterProvider;

    @Expose()
    declare osuID: number;

    @Expose()
    declare createdAt: Date;

    @Expose()
    declare updatedAt: Date;
}

@Exclude()
export class UserDto {
    @Expose()
    declare id: string;

    @Expose()
    declare linked: Array<UserToOsuDto> | null;

    @Expose()
    declare server: AdapterProvider | null;

    @Expose()
    declare mode: GameMode | null;

    @Expose()
    declare scoreListSize: EScoreListSize;

    @Expose()
    declare scoreActions: boolean;

    @Expose()
    declare createdAt: Date;

    @Expose()
    declare updatedAt: Date;
}

//#region API

export class UserConfigUpdateDto {
    server?: AdapterProvider | null;
    mode?: GameMode | null;
    scoreListSize?: EScoreListSize | null;
    scoreActions?: boolean;
}

//#endregion
