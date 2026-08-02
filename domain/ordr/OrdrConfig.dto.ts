import { Exclude, Expose, Type } from "class-transformer";

export enum EOrdrConfigSource {
    Bot = "Bot",
    Preset = "Preset",
}

export enum EOrdrResolution {
    SD = "960x540",
    HD = "1280x720",
}

@Exclude()
export class OrdrSettingsDto {
    //#region Output

    @Expose()
    declare skin: string;

    @Expose()
    declare customSkin: boolean;

    @Expose()
    declare resolution: EOrdrResolution;

    @Expose()
    declare skip: boolean;

    @Expose()
    declare showResultScreen: boolean;

    //#endregion

    //#region Audio

    @Expose()
    declare globalVolume: number;

    @Expose()
    declare musicVolume: number;

    @Expose()
    declare hitsoundVolume: number;

    @Expose()
    declare useSkinHitsounds: boolean;

    @Expose()
    declare playNightcoreSamples: boolean;

    //#endregion

    //#region HUD

    @Expose()
    declare showHitErrorMeter: boolean;

    @Expose()
    declare showUnstableRate: boolean;

    @Expose()
    declare showScore: boolean;

    @Expose()
    declare showHPBar: boolean;

    @Expose()
    declare showComboCounter: boolean;

    @Expose()
    declare showPPCounter: boolean;

    @Expose()
    declare showScoreboard: boolean;

    @Expose()
    declare showAvatarsOnScoreboard: boolean;

    @Expose()
    declare showBorders: boolean;

    @Expose()
    declare showMods: boolean;

    @Expose()
    declare showAimErrorMeter: boolean;

    @Expose()
    declare showHitCounter: boolean;

    @Expose()
    declare showKeyOverlay: boolean;

    @Expose()
    declare showStrainGraph: boolean;

    @Expose()
    declare showSliderBreaks: boolean;

    //#endregion

    //#region Gameplay

    @Expose()
    declare useSkinCursor: boolean;

    @Expose()
    declare useSkinColors: boolean;

    @Expose()
    declare useBeatmapColors: boolean;

    @Expose()
    declare cursorSize: number;

    @Expose()
    declare cursorTrail: boolean;

    @Expose()
    declare sliderSnakingIn: boolean;

    @Expose()
    declare sliderSnakingOut: boolean;

    @Expose()
    declare ignoreFail: boolean;

    //#endregion

    //#region Background

    @Expose()
    declare loadStoryboard: boolean;

    @Expose()
    declare loadVideo: boolean;

    @Expose()
    declare introBGDim: number;

    @Expose()
    declare inGameBGDim: number;

    @Expose()
    declare breakBGDim: number;

    @Expose()
    declare showDanserLogo: boolean;

    //#endregion
}

@Exclude()
export class OrdrConfigDto {
    @Expose()
    declare userID: string;

    @Expose()
    declare source: EOrdrConfigSource;

    @Expose()
    @Type(() => OrdrSettingsDto)
    declare settings: OrdrSettingsDto;

    @Expose()
    declare createdAt: Date;

    @Expose()
    declare updatedAt: Date;
}
