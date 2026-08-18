import { EScoreListSize } from "@domain/osu/enums/Score.enum";
import { AdapterProvider, GameMode } from "@generated/adapter/types";
import { Exclude, Expose } from "class-transformer";

@Exclude()
export class GuildDto {
    @Expose()
    declare id: string;

    @Expose()
    declare prefix: string | null;

    @Expose()
    declare server: AdapterProvider | null;

    @Expose()
    declare mode: GameMode | null;

    @Expose()
    declare scoreListSize: EScoreListSize | null;

    @Expose()
    declare spoilMedals: boolean;
}

//#region API

export class GuildConfigUpdateDto {
    declare prefix?: string | null;
    declare server?: AdapterProvider | null;
    declare mode?: GameMode | null;
    declare scoreListSize?: EScoreListSize | null;
    declare spoilMedals?: boolean;
}

//#endregion
