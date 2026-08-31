import { ParsedMod } from "@generated/adapter/mods";
import type { GameMode } from "@generated/adapter/types";
import type {
    BeatmapAttributes,
    DifficultyRequest,
    HitResultResponse,
    PerformanceRequest,
} from "@generated/calculator/calculator";

export enum ECalculatorType {
    Native = "Native",
}

//#region Difficulty

export type TStandardSkillName = "Aim" | "AimNoSliders" | "Speed" | "Flashlight";
export type TTaikoSkillName = "Colour" | "Rhythm" | "Stamina";
export type TCatchSkillName = "Movement";
export type TManiaSkillName = "Strain";

export type TSkillName<M extends GameMode> = M extends GameMode.Standard
    ? TStandardSkillName
    : M extends GameMode.Taiko
      ? TTaikoSkillName
      : M extends GameMode.Catch
        ? TCatchSkillName
        : M extends GameMode.Mania
          ? TManiaSkillName
          : string;

export interface ISkillStrainPoint {
    timeMs: number;
    value: number;
}

export interface ISkillStrain<M extends GameMode> {
    skillName: TSkillName<M> | (string & {});
    points: Array<ISkillStrainPoint>;
}

export interface IBaseDifficultyAttributes {
    starRating: number;
    maxCombo: number;
    [key: string]: number;
}

export interface IStandardDifficultyAttributes extends IBaseDifficultyAttributes {
    aimDifficulty: number;
    aimDifficultSliderCount: number;

    speedDifficulty: number;
    speedNoteCount: number;

    flashlightDifficulty: number;
    readingDifficulty: number;

    sliderFactor: number;

    aimTopWeightedSliderFactor: number;
    speedTopWeightedSliderFactor: number;

    aimDifficultStrainCount: number;
    speedDifficultStrainCount: number;
    readingDifficultNoteCount: number;

    nestedScorePerObject: number;
    legacyScoreBaseMultiplier: number;
    maximumLegacyComboScore: number;

    hitCircleCount: number;
    sliderCount: number;
    spinnerCount: number;
}

export interface ITaikoDifficultyAttributes extends IBaseDifficultyAttributes {
    mechanicalDifficulty: number;
    rhythmDifficulty: number;
    readingDifficulty: number;
    colourDifficulty: number;
    staminaDifficulty: number;
    monoStaminaFactor: number;
    consistencyFactor: number;
    staminaTopStrains: number;
}

export interface ICatchDifficultyAttributes extends IBaseDifficultyAttributes {}
export interface IManiaDifficultyAttributes extends IBaseDifficultyAttributes {}

export type TDifficultyAttributes<M extends GameMode> = M extends GameMode.Standard
    ? IStandardDifficultyAttributes
    : M extends GameMode.Taiko
      ? ITaikoDifficultyAttributes
      : M extends GameMode.Catch
        ? ICatchDifficultyAttributes
        : M extends GameMode.Mania
          ? IManiaDifficultyAttributes
          : IBaseDifficultyAttributes;

export interface ICalculateDifficultyOptions<M extends GameMode> {
    mode: M;
    beatmapPath: DifficultyRequest["beatmapPath"];
    mods?: DifficultyRequest["mods"];
    passedObjects?: DifficultyRequest["passedObjects"];
    clockRate?: DifficultyRequest["clockRate"];
    calculateStrains?: DifficultyRequest["calculateStrains"];
    strainPointLimit?: DifficultyRequest["strainPointLimit"];
}

export interface IDifficultyCalculationResponse<M extends GameMode> {
    attributes: TDifficultyAttributes<M>;
    beatmap: BeatmapAttributes;
    strains?: Array<ISkillStrain<M>>;
}

//#endregion Difficulty

//#region Performance

export interface IBasePerformanceAttributes {
    total: number;
    [key: string]: number;
}

export interface IStandardPerformanceAttributes extends IBasePerformanceAttributes {
    aim: number;
    speed: number;
    accuracy: number;
    flashlight: number;
    effectiveMissCount: number;
    comboBasedEstimatedMissCount: number;
    aimEstimatedSliderBreaks: number;
    speedEstimatedSliderBreaks: number;
}

export interface ITaikoPerformanceAttributes extends IBasePerformanceAttributes {}
export interface ICatchPerformanceAttributes extends IBasePerformanceAttributes {}
export interface IManiaPerformanceAttributes extends IBasePerformanceAttributes {}

export type TPerformanceAttributes<M extends GameMode> = M extends GameMode.Standard
    ? IStandardPerformanceAttributes
    : M extends GameMode.Taiko
      ? ITaikoPerformanceAttributes
      : M extends GameMode.Catch
        ? ICatchPerformanceAttributes
        : M extends GameMode.Mania
          ? IManiaPerformanceAttributes
          : IBasePerformanceAttributes;

export interface ICalculatePerformanceOptions<M extends GameMode> {
    mode: M;
    beatmapPath: PerformanceRequest["beatmapPath"];
    precalculatedDifficulty?: TDifficultyAttributes<M> | undefined;
    score: PerformanceRequest["score"];
    passedObjects?: PerformanceRequest["passedObjects"];
    mods?: PerformanceRequest["mods"];
    clockRate?: PerformanceRequest["clockRate"];
    referenceId?: PerformanceRequest["referenceId"];
    totalScore?: PerformanceRequest["totalScore"];
    legacyTotalScore?: PerformanceRequest["legacyTotalScore"];
}

export interface IPerformanceCalculationResponse<M extends GameMode> {
    attributes: TPerformanceAttributes<M>;
    difficulty: IDifficultyCalculationResponse<M>;
    hitResults?: HitResultResponse;
    referenceId?: PerformanceRequest["referenceId"];
}

//#endregion

//#region Utils

export type TCalculatorMods = NonNullable<DifficultyRequest["mods"]>;

export function toCalculatorMods(mods: ReadonlyArray<ParsedMod>): TCalculatorMods {
    return mods.map((mod) => ({
        acronym: mod.acronym,
        settings: mod.settings
            ? Object.fromEntries(Object.entries(mod.settings).map(([key, value]) => [key, String(value)]))
            : {},
    }));
}

//#endregion
