import { AbstractService } from "@/core/framework/AbstractService";
import { IStandardDifficultyAttributes, ITaikoDifficultyAttributes } from "@domain/core/Calculator";
import { SkillCalculationResultDto, SkillCategoryResultDto, SkillScoreResultDto } from "@domain/osu/Skill.dto";
import { PopulatedScore } from "@domain/osu/Score.dto";
import { BeatmapAttributesCalculator } from "@domain/osu/utils/BeatmapAttributesCalculator";
import { GameMode } from "@generated/adapter/types";
import { ESkillType } from "@domain/osu/enums/Skill.enum";
import { clamp, isValidNumber, smoothstep } from "@domain/utils";
import { ModUtils } from "@generated/adapter/mods";

interface IScoreSkillValues {
    score: PopulatedScore;
    values: Partial<Record<ESkillType, number>>;
}

interface ISkillFormulaInput {
    stars: number;
    bpm: number;

    ar: number;
    od: number;
    cs: number;
    hp: number;

    accuracy: number;
    combo: number;
    misses: number;

    maxCombo: number;
    hitLength: number;

    countCircles: number;
    countSliders: number;
    countSpinners: number;
    objectCount: number;

    keys: number;

    hasHidden: boolean;
    hasFlashlight: boolean;

    aimDifficulty?: number;
    speedDifficulty?: number;
    readingDifficulty?: number;
    taikoDifficulty?: ITaikoDifficultyAttributes;
}

interface ISkillDefinition {
    type: ESkillType;
    label: string;
}

export class SkillCalculatorService extends AbstractService {
    private static readonly topScoreCount = 3;
    private static readonly standardWeightDecay = 0.901;
    private static readonly standardWeightDivisor = 10;

    public calculate(mode: GameMode, scores: Array<PopulatedScore>): SkillCalculationResultDto {
        const evaluated = scores.map<IScoreSkillValues>((score) => ({
            score,
            values: this.calculateScore(mode, score),
        }));

        const weighted = mode === GameMode.Standard;

        return {
            categories: this.getSkillDefinitions(mode).map((definition) =>
                this.buildCategory(definition, evaluated, weighted),
            ),
        };
    }

    private calculateScore(mode: GameMode, score: PopulatedScore): Partial<Record<ESkillType, number>> {
        const input = this.createFormulaInput(mode, score);

        if (!this.isUsableInput(input)) {
            return {};
        }

        switch (mode) {
            case GameMode.Standard:
                return this.calculateStandard(input);
            case GameMode.Taiko:
                return this.calculateTaiko(input);
            case GameMode.Catch:
                return this.calculateCatch(input);
            case GameMode.Mania:
                return this.calculateMania(input);
            default:
                return {};
        }
    }

    private createFormulaInput(mode: GameMode, score: PopulatedScore): ISkillFormulaInput {
        const beatmapAttributes = BeatmapAttributesCalculator.calculate(score.beatmap, score.mods);
        const standardDifficulty = score.fullDifficulty as Partial<IStandardDifficultyAttributes>;
        const accuracy = score.accuracy * 100;

        const countCircles = score.beatmap.countCircles;
        const countSliders = score.beatmap.countSliders;
        const countSpinners = score.beatmap.countSpinners;

        return {
            stars: score.fullDifficulty.starRating,
            bpm: BeatmapAttributesCalculator.bpm(score.beatmap.bpm, beatmapAttributes.clockRate),

            ar: beatmapAttributes.ar,
            od: beatmapAttributes.od,
            cs: beatmapAttributes.cs,
            hp: beatmapAttributes.hp,

            accuracy: clamp(accuracy, 0, 100),
            combo: score.maxCombo,
            misses: score.statistics.miss ?? 0,

            maxCombo: score.fullDifficulty.maxCombo,
            hitLength: BeatmapAttributesCalculator.length(score.beatmap.hitLength, beatmapAttributes.clockRate),

            countCircles,
            countSliders,
            countSpinners,
            objectCount: countCircles + countSliders + countSpinners,

            keys: this.resolveManiaKeys(score),

            hasHidden: ModUtils.has(score.mods, "HD"),
            hasFlashlight: ModUtils.has(score.mods, "FL"),

            aimDifficulty: standardDifficulty.aimDifficulty,
            speedDifficulty: standardDifficulty.speedDifficulty,
            readingDifficulty: standardDifficulty.readingDifficulty,

            taikoDifficulty: mode === GameMode.Taiko ? (score.fullDifficulty as ITaikoDifficultyAttributes) : undefined,
        };
    }

    private calculateStandard(input: ISkillFormulaInput): Partial<Record<ESkillType, number>> {
        if (!isValidNumber(input.aimDifficulty) || !isValidNumber(input.speedDifficulty)) {
            return {};
        }

        const AIM_MULTIPLIER = 1.9;
        const SPEED_MULTIPLIER = 2.2;
        const ACC_MULTIPLIER = 1.6;
        const STAMINA_MULTIPLIER = 1.19;
        const READING_MULTIPLIER = 2;

        const accuracyFactor =
            input.accuracy >= 95
                ? 1 + Math.min(0.235, (input.accuracy / 100) * (-0.8883 + input.od / 10))
                : 1 + 0.015 * (Math.pow(input.accuracy / 95, 2.5) - (0.7 + 0.4 * (input.od / 9)));

        const csBonus = 1 + Math.min(0.2, 1 / (5.5 + Math.exp(-1.2 * (input.cs - 6.5))));

        const comboRatio = input.maxCombo > 0 ? clamp(input.combo / input.maxCombo, 0, 1) : 0;

        const comboFactor =
            ((Math.pow(1.1, comboRatio) - 0.2) * Math.pow(Math.max(0, input.countCircles), 0.04)) / Math.pow(300, 0.1);

        const missPenalty = 1 - Math.min(0.2, input.misses * 0.007);
        const bpmBonus = 1 + Math.min(0.2, (input.bpm - 100) * 0.002);

        const aimStrainScale = input.aimDifficulty * missPenalty * bpmBonus;
        const aimSkill = aimStrainScale * csBonus * accuracyFactor * Math.pow(comboFactor, 0.9);

        const arBonus = input.ar >= 10.3 ? 1 + Math.min(0.2, (input.ar - 10.29) * 0.04) : 1;

        const bpmFactor = 1 + Math.min(0.2, Math.exp(0.005 * (input.bpm - 240)) - 1);

        const speedStrainScale = input.speedDifficulty * missPenalty * bpmFactor * arBonus;
        const speedSkill = speedStrainScale * accuracyFactor * Math.pow(comboFactor, 0.85);

        const totalStrain = input.aimDifficulty + input.speedDifficulty;
        const aimShare = totalStrain > 0 ? input.aimDifficulty / totalStrain : 0;

        const aimDominance = smoothstep(0.65, 0.85, aimShare);
        const jumpMapPenalty = 1 - 0.1 * aimDominance;

        const odFactor = input.od >= 9 ? 1 + 0.05 * (input.od - 9) : 1 - 0.03 * (9 - input.od);
        const lengthBonus = 1 + Math.log10((Math.min(input.countCircles, 1000) / 250 + 1) * 1.1) * 0.15;

        const difficultyFactor = Math.pow(1 + Math.sqrt(Math.pow(aimSkill, 2) + Math.pow(speedSkill, 2)) * 0.25, 1.25);
        const accuracyWeight = Math.pow(0.1 + (input.accuracy / 100) * 1.01, 3.8);

        const accuracySkill =
            Math.pow(input.accuracy / 100, 5) *
            odFactor *
            jumpMapPenalty *
            lengthBonus *
            bpmBonus *
            difficultyFactor *
            accuracyWeight;

        const safeHitLength = Math.max(input.hitLength, Number.EPSILON);
        const hitObjectDensity = input.countCircles / safeHitLength;

        const lengthFactor = Math.pow(safeHitLength / 60, 0.7) * (1 + Math.max(0, (input.bpm - 180) / 200));

        const adjustedDensity = hitObjectDensity * lengthFactor;
        const densityFactor = Math.pow(adjustedDensity / 2, 0.25);

        const difficultyAdjust = Math.pow(
            1 + Math.sqrt(Math.pow(input.speedDifficulty * 1.4, 2) + Math.pow(aimSkill * 0.93, 2)) * 0.3,
            1.25,
        );

        const staminaBpmFactor = 1 + Math.min(0.2, Math.exp(0.005 * (input.bpm - 200)) - 1);

        const staminaSkill =
            densityFactor *
            difficultyAdjust *
            Math.pow(csBonus, 0.5) *
            Math.pow(arBonus, 0.5) *
            staminaBpmFactor *
            missPenalty *
            Math.pow(comboFactor, 0.5) *
            Math.pow(accuracyFactor, 0.6);

        const readingBase = input.readingDifficulty || 0;
        const readingComboFactor = 0.85 + 0.15 * Math.sqrt(comboRatio);
        const readingAccuracyFactor = 0.8 + 0.2 * Math.pow(input.accuracy / 100, 3);

        const noteDensityBase = (input.bpm * (13 - input.ar)) / 200;
        const upperCap = 1.1;
        const lowerCap = 0.95;
        const scalingSpeed = 0.2;
        const noteDensityFactor =
            1 +
            Math.sign(noteDensityBase - 4) *
                ((upperCap - lowerCap) / 2 + ((upperCap + lowerCap - 2) / 2) * Math.sign(noteDensityBase - 4)) *
                (1 - Math.exp(-scalingSpeed * Math.abs(noteDensityBase - 4)));

        const readingSkill = readingBase * readingComboFactor * readingAccuracyFactor * missPenalty * noteDensityFactor;

        return this.sanitizeValues({
            [ESkillType.Aim]: aimSkill * AIM_MULTIPLIER,
            [ESkillType.Speed]: speedSkill * SPEED_MULTIPLIER,
            [ESkillType.Accuracy]: accuracySkill * ACC_MULTIPLIER,
            [ESkillType.Stamina]: staminaSkill * STAMINA_MULTIPLIER,
            [ESkillType.Reading]: readingSkill * READING_MULTIPLIER,
        });
    }

    private calculateTaiko(input: ISkillFormulaInput): Partial<Record<ESkillType, number>> {
        const difficulty = input.taikoDifficulty;

        if (!difficulty) {
            return {};
        }

        const accuracy = this.accuracyRatio(input);
        const combo = this.comboRatio(input);
        const missPenalty = Math.pow(0.985, input.misses);

        const rhythmBase = this.taikoSkillBase(input.stars, difficulty.rhythmDifficulty);
        const colourBase = this.taikoSkillBase(input.stars, difficulty.colourDifficulty);
        const staminaBase = this.taikoSkillBase(input.stars, difficulty.staminaDifficulty);
        const readingBase = this.taikoSkillBase(input.stars, difficulty.readingDifficulty);

        const rhythmExecution = 0.88 + 0.37 * Math.pow(accuracy, 5);
        const rhythmComboFactor = 0.94 + 0.06 * Math.sqrt(combo);

        const colourExecution = 0.91 + 0.31 * Math.pow(accuracy, 2);
        const colourComboFactor = 0.9 + 0.1 * Math.sqrt(combo);

        const readingExecution = 0.87 + 0.3 * Math.pow(accuracy, 3);
        const readingComboFactor = 0.94 + 0.08 * Math.sqrt(combo);
        const readingModFactor = (input.hasHidden ? 1.02 : 1) * (input.hasFlashlight ? 1.04 : 1);

        const consistencyFactor = 0.95 + 0.05 * clamp(difficulty.consistencyFactor, 0, 1);
        const strainLengthFactor = 0.97 + 0.03 * clamp((difficulty.staminaTopStrains - 1000) / 555, 0, 1);
        const monoFactor = 0.98 + 0.04 * clamp(difficulty.monoStaminaFactor, 0, 1);

        const staminaExecution = 0.86 + 0.29 * Math.pow(accuracy, 2.5);
        const staminaComboFactor = 0.9 + 0.1 * Math.sqrt(combo);

        const rhythm = rhythmBase * rhythmExecution * rhythmComboFactor * missPenalty;
        const colour = colourBase * colourExecution * colourComboFactor * missPenalty;

        const reading = readingBase * readingExecution * readingComboFactor * readingModFactor * missPenalty;

        const stamina =
            staminaBase *
            staminaExecution *
            staminaComboFactor *
            consistencyFactor *
            strainLengthFactor *
            monoFactor *
            missPenalty;

        return this.sanitizeValues({
            [ESkillType.Rhythm]: rhythm,
            [ESkillType.Colour]: colour,
            [ESkillType.Stamina]: stamina,
            [ESkillType.Reading]: reading,
        });
    }

    private taikoSkillBase(stars: number, component: number): number {
        if (stars <= 0 || component <= 0) {
            return 0;
        }

        const componentShare = component / stars;
        const relativeShare = componentShare / 0.25;

        const specializationFactor = Math.pow(relativeShare, 0.2);
        const boundedFactor = clamp(specializationFactor, 0.72, 1.25);

        return stars * boundedFactor;
    }

    private calculateCatch(input: ISkillFormulaInput): Partial<Record<ESkillType, number>> {
        const accuracy = this.accuracyRatio(input);
        const combo = this.comboRatio(input);

        const missRate = input.misses / Math.max(1, input.maxCombo);

        const movementExecution = 0.86 + 0.24 * Math.pow(accuracy, 2) + 0.1 * Math.sqrt(combo);

        const movementMissPenalty = Math.exp(-Math.min(0.3, missRate * 8));
        const movement = input.stars * movementExecution * movementMissPenalty;

        const accuracyExecution = 0.72 + 0.46 * Math.pow(accuracy, 10);
        const accuracyComboFactor = 0.96 + 0.04 * Math.sqrt(combo);
        const accuracyMissPenalty = Math.exp(-Math.min(0.2, missRate * 4));

        const lengthFactor = 0.95 + 0.05 * this.normalizedLogLength(input.maxCombo, 2500);

        const accuracySkill =
            input.stars * accuracyExecution * accuracyComboFactor * accuracyMissPenalty * lengthFactor;

        return this.sanitizeValues({
            [ESkillType.Movement]: movement,
            [ESkillType.Accuracy]: accuracySkill,
        });
    }

    private calculateMania(input: ISkillFormulaInput): Partial<Record<ESkillType, number>> {
        const accuracy = this.accuracyRatio(input);
        const combo = this.comboRatio(input);

        const keys = Math.max(1, input.keys);
        const hitLength = Math.max(1, input.hitLength);

        const actionsPerSecond = input.maxCombo / hitLength;
        const actionsPerSecondPerKey = actionsPerSecond / keys;

        const normalizedDensity = clamp(actionsPerSecondPerKey / 1.05, 0.65, 1.75);
        const densityFactor = Math.pow(normalizedDensity, 0.18);

        const missRate = input.misses / Math.max(1, input.objectCount);

        const strainExecution = 0.82 + 0.26 * Math.pow(accuracy, 4) + 0.1 * Math.sqrt(combo);

        const strainMissPenalty = Math.exp(-Math.min(0.3, missRate * 10));
        const strain = input.stars * strainExecution * strainMissPenalty;

        const speedExecution = 0.79 + 0.25 * Math.pow(accuracy, 3) + 0.08 * Math.sqrt(combo);

        const speedMissPenalty = Math.exp(-Math.min(0.25, missRate * 8));
        const speed = input.stars * densityFactor * speedExecution * speedMissPenalty;

        const odFactor = 1 + clamp((input.od - 8) * 0.025, -0.075, 0.1);
        const lengthFactor = 0.95 + 0.05 * this.normalizedLogLength(input.maxCombo, 1500);

        const accuracyExecution = 0.65 + 0.54 * Math.pow(accuracy, 12);
        const accuracyComboFactor = 0.97 + 0.04 * Math.sqrt(combo);
        const accuracyMissPenalty = Math.exp(-Math.min(0.18, missRate * 6));

        const accuracySkill =
            input.stars * odFactor * lengthFactor * accuracyExecution * accuracyComboFactor * accuracyMissPenalty;

        return this.sanitizeValues({
            [ESkillType.Strain]: strain,
            [ESkillType.Speed]: speed,
            [ESkillType.Accuracy]: accuracySkill,
        });
    }

    private accuracyRatio(input: ISkillFormulaInput): number {
        return clamp(input.accuracy / 100, 0, 1);
    }

    private comboRatio(input: ISkillFormulaInput): number {
        if (input.maxCombo <= 0) {
            return 0;
        }

        return clamp(input.combo / input.maxCombo, 0, 1);
    }

    private normalizedLogLength(value: number, reference: number): number {
        if (value <= 0 || reference <= 0) {
            return 0;
        }

        return clamp(Math.log1p(value) / Math.log1p(reference), 0, 1);
    }

    private buildCategory(
        definition: ISkillDefinition,
        evaluated: Array<IScoreSkillValues>,
        weighted: boolean,
    ): SkillCategoryResultDto {
        const results: Array<SkillScoreResultDto> = [];

        for (const item of evaluated) {
            const value = item.values[definition.type];

            if (!this.isValidSkillValue(value)) {
                continue;
            }

            results.push({
                score: item.score,
                value,
            });
        }

        results.sort((a, b) => b.value - a.value);

        return {
            type: definition.type,
            label: definition.label,
            average: weighted ? this.calculateWeightedAverage(results) : this.calculateArithmeticAverage(results),
            topScores: results.slice(0, SkillCalculatorService.topScoreCount),
        };
    }

    private resolveManiaKeys(score: PopulatedScore): number {
        const keyMod = score.mods.find((mod) => /^[1-9]K$/.test(mod.acronym));

        if (keyMod) {
            return Number(keyMod.acronym[0]);
        }

        return Math.max(1, Math.round(score.beatmap.cs));
    }

    private calculateWeightedAverage(scores: Array<SkillScoreResultDto>): number {
        if (!scores.length) {
            return 0;
        }

        let total = 0;
        let weight = 1;

        for (const score of scores) {
            total += score.value * weight;
            weight *= SkillCalculatorService.standardWeightDecay;
        }

        return total / SkillCalculatorService.standardWeightDivisor;
    }

    private calculateArithmeticAverage(scores: Array<SkillScoreResultDto>): number {
        if (!scores.length) {
            return 0;
        }

        const total = scores.reduce((sum, score) => sum + score.value, 0);
        return total / scores.length;
    }

    private getSkillDefinitions(mode: GameMode): Array<ISkillDefinition> {
        switch (mode) {
            case GameMode.Standard:
                return [
                    { type: ESkillType.Aim, label: "Aim" },
                    { type: ESkillType.Speed, label: "Speed" },
                    { type: ESkillType.Accuracy, label: "Accuracy" },
                    { type: ESkillType.Stamina, label: "Stamina" },
                    { type: ESkillType.Reading, label: "Reading" },
                ];

            case GameMode.Taiko:
                return [
                    { type: ESkillType.Rhythm, label: "Rhythm" },
                    { type: ESkillType.Colour, label: "Colour" },
                    { type: ESkillType.Stamina, label: "Stamina" },
                    { type: ESkillType.Reading, label: "Reading" },
                ];

            case GameMode.Catch:
                return [
                    { type: ESkillType.Movement, label: "Movement" },
                    { type: ESkillType.Accuracy, label: "Accuracy" },
                ];

            case GameMode.Mania:
                return [
                    { type: ESkillType.Strain, label: "Strain" },
                    { type: ESkillType.Speed, label: "Speed" },
                    { type: ESkillType.Accuracy, label: "Accuracy" },
                ];

            default:
                return [];
        }
    }

    private sanitizeValues(values: Partial<Record<ESkillType, number>>): Partial<Record<ESkillType, number>> {
        const sanitized: Partial<Record<ESkillType, number>> = {};

        for (const [type, value] of Object.entries(values) as Array<[ESkillType, number | undefined]>) {
            if (this.isValidSkillValue(value)) {
                sanitized[type] = value;
            }
        }

        return sanitized;
    }

    private isUsableInput(input: ISkillFormulaInput): boolean {
        return (
            isValidNumber(input.stars) &&
            input.stars > 0 &&
            isValidNumber(input.bpm) &&
            input.bpm > 0 &&
            isValidNumber(input.accuracy) &&
            isValidNumber(input.hitLength)
        );
    }

    private isValidSkillValue(value: number | undefined): value is number {
        return isValidNumber(value) && value >= 0;
    }
}
