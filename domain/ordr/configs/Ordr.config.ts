import { EOrdrResolution, OrdrSettingsDto } from "@domain/ordr/OrdrConfig.dto";
import { plainToInstance } from "class-transformer";

export const ordrDataDelimiter = "  •  ";

const defaultSettings = {
    customSkin: false,
    resolution: EOrdrResolution.HD,
    skip: true,
    showResultScreen: true,

    globalVolume: 50,
    musicVolume: 50,
    hitsoundVolume: 50,
    useSkinHitsounds: true,
    playNightcoreSamples: true,

    showHitErrorMeter: true,
    showUnstableRate: true,
    showScore: true,
    showHPBar: true,
    showComboCounter: true,
    showPPCounter: true,
    showScoreboard: false,
    showAvatarsOnScoreboard: false,
    showBorders: false,
    showMods: true,
    showAimErrorMeter: false,
    showHitCounter: false,
    showKeyOverlay: true,
    showStrainGraph: false,
    showSliderBreaks: false,

    useSkinCursor: true,
    useSkinColors: false,
    useBeatmapColors: true,
    cursorSize: 1,
    cursorTrail: true,
    sliderSnakingIn: true,
    sliderSnakingOut: true,
    ignoreFail: false,

    loadStoryboard: true,
    loadVideo: true,
    introBGDim: 0,
    inGameBGDim: 75,
    breakBGDim: 30,
    showDanserLogo: true,
} satisfies Omit<OrdrSettingsDto, "skin">;

export function createDefaultOrdrSettings(defaultSkin: string): OrdrSettingsDto {
    return plainToInstance(
        OrdrSettingsDto,
        {
            skin: defaultSkin,
            ...defaultSettings,
        },
        {
            excludeExtraneousValues: true,
        },
    );
}
