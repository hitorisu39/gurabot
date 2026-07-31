import { EApplicationError, Exception } from "@domain/core/Exception";
import { CommandOption } from "@domain/core/Command";
import { ESimulateScoringMode } from "@domain/osu/enums/Simulate.enum";
import { SimulateStatisticsDto, SimulateViewDto } from "@domain/osu/views/Simulate.view";
import { Beatmap, GameMode } from "@generated/adapter/types";
import { SimulateQueryDto } from "../Simulate.dto";

export interface ISimulateParameters {
    accuracy?: number;
    combo?: number;

    clockRate?: number;
    bpm?: number;

    attributes: {
        ar?: number;
        cs?: number;
        od?: number;
        hp?: number;
    };

    statistics: Partial<SimulateStatisticsDto>;

    legacyTotalScore?: number;
    scoringMode?: ESimulateScoringMode;
}

type TAttributeName = keyof ISimulateParameters["attributes"];
type TStatisticName = keyof SimulateStatisticsDto;

export class SimulateParametersParser {
    private static readonly minimumClockRate = 0.5;
    private static readonly maximumClockRate = 2;

    public static parse(shorthand: string, query: SimulateQueryDto | undefined, mode: GameMode): ISimulateParameters {
        const result: ISimulateParameters = {
            attributes: {},
            statistics: {},
        };

        const seen = new Set<string>();
        const tokens = shorthand.trim().split(/\s+/).filter(Boolean);

        for (const token of tokens) {
            this.parseShorthandToken(token, mode, result, seen);
        }

        if (query !== undefined) {
            this.parseQuery(query, mode, result, seen);
        }

        this.validateResult(result);

        return result;
    }

    public static apply(data: SimulateViewDto, parameters: ISimulateParameters, beatmap: Beatmap): void {
        if (parameters.accuracy !== undefined) {
            data.accuracy = parameters.accuracy;
        }

        if (parameters.combo !== undefined) {
            data.combo = parameters.combo;
        }

        if (parameters.clockRate !== undefined) {
            data.clockRate = parameters.clockRate;
        } else if (parameters.bpm !== undefined) {
            if (!Number.isFinite(beatmap.bpm) || beatmap.bpm <= 0) {
                throw new Exception(
                    EApplicationError.INPUT_ERROR,
                    "Cannot calculate clock rate because the beatmap has no valid BPM.",
                );
            }

            const clockRate = parameters.bpm / beatmap.bpm;

            if (clockRate < this.minimumClockRate || clockRate > this.maximumClockRate) {
                throw new Exception(
                    EApplicationError.INPUT_ERROR,
                    `The requested BPM results in a clock rate of ${clockRate.toFixed(2)}x. ` +
                        `Clock rate must be between ${this.minimumClockRate}x and ${this.maximumClockRate}x.`,
                );
            }

            data.clockRate = clockRate;
        }

        this.assignDefined(data.attributes, "ar", parameters.attributes.ar);
        this.assignDefined(data.attributes, "cs", parameters.attributes.cs);
        this.assignDefined(data.attributes, "od", parameters.attributes.od);
        this.assignDefined(data.attributes, "hp", parameters.attributes.hp);
        this.assignDefined(data.statistics, "count300", parameters.statistics.count300);
        this.assignDefined(data.statistics, "count100", parameters.statistics.count100);
        this.assignDefined(data.statistics, "count50", parameters.statistics.count50);
        this.assignDefined(data.statistics, "countMiss", parameters.statistics.countMiss);
        this.assignDefined(data.statistics, "countGeki", parameters.statistics.countGeki);
        this.assignDefined(data.statistics, "countKatu", parameters.statistics.countKatu);
        this.assignDefined(data.statistics, "countSliderTailMisses", parameters.statistics.countSliderTailMisses);
        this.assignDefined(data.statistics, "countLargeTickMisses", parameters.statistics.countLargeTickMisses);

        if (parameters.legacyTotalScore !== undefined) {
            data.legacyTotalScore = parameters.legacyTotalScore;
        }

        if (parameters.scoringMode !== undefined) {
            data.scoringMode = parameters.scoringMode;
        }

        if (parameters.scoringMode === ESimulateScoringMode.Lazer) {
            data.legacyTotalScore = undefined;
        }

        const hasAttributeOverrides = Object.values(parameters.attributes).some((value) => value !== undefined);

        if (hasAttributeOverrides) {
            /*
             * DA overrides conflict conceptually with HR/EZ attribute
             * modifications. This matches the attributes modal behaviour.
             *
             * CL is intentionally preserved.
             */
            data.mods = data.mods.filter((mod) => mod.acronym !== "HR" && mod.acronym !== "EZ");
        }
    }

    private static parseShorthandToken(
        rawToken: string,
        mode: GameMode,
        result: ISimulateParameters,
        seen: Set<string>,
    ): void {
        const token = rawToken.trim();

        let match: RegExpMatchArray | null;

        /*
         * Hit-result forms must be checked before the generic combo form.
         *
         * For example:
         *
         * 4x100 -> four 100s
         * 400x  -> 400 combo
         */

        if ((match = token.match(/^(\d+)x300$/i))) {
            this.setStatistic(result, seen, "count300", this.parseInteger(match[1]!, "300 count"), "300 count");
            return;
        }

        if ((match = token.match(/^(\d+)x100$/i))) {
            this.setStatistic(result, seen, "count100", this.parseInteger(match[1]!, "100 count"), "100 count");
            return;
        }

        if ((match = token.match(/^(\d+)x50$/i))) {
            this.requireMode(mode, [GameMode.Standard, GameMode.Catch, GameMode.Mania], "50 count");

            this.setStatistic(result, seen, "count50", this.parseInteger(match[1]!, "50 count"), "50 count");
            return;
        }

        if ((match = token.match(/^(\d+)xgeki$/i))) {
            this.requireMode(mode, [GameMode.Mania], "Gekis");

            this.setStatistic(result, seen, "countGeki", this.parseInteger(match[1]!, "Geki count"), "Geki count");
            return;
        }

        if ((match = token.match(/^(\d+)xkatu$/i))) {
            this.requireMode(mode, [GameMode.Catch, GameMode.Mania], "Katus");

            this.setStatistic(result, seen, "countKatu", this.parseInteger(match[1]!, "Katu count"), "Katu count");
            return;
        }

        if ((match = token.match(/^(\d+)xsliderends$/i))) {
            this.requireMode(mode, [GameMode.Standard], "Slider ends");

            /*
             * The simulation DTO stores missed slider tails.
             */
            this.setStatistic(
                result,
                seen,
                "countSliderTailMisses",
                this.parseInteger(match[1]!, "Missed slider-end count"),
                "Slider ends",
            );
            return;
        }

        if ((match = token.match(/^(\d+)xlargeticks$/i))) {
            this.requireMode(mode, [GameMode.Standard], "Large ticks");

            /*
             * The simulation DTO stores missed large ticks.
             */
            this.setStatistic(
                result,
                seen,
                "countLargeTickMisses",
                this.parseInteger(match[1]!, "Missed large-tick count"),
                "Large ticks",
            );
            return;
        }

        if ((match = token.match(/^(\d+)xsmallticks$/i))) {
            this.requireMode(mode, [GameMode.Catch], "Small ticks");

            /*
             * Catch small-tick hits are represented by count50 in the
             * existing simulation statistics model.
             */
            this.setStatistic(result, seen, "count50", this.parseInteger(match[1]!, "Small-tick count"), "Small ticks");
            return;
        }

        if ((match = token.match(/^(\d+)m$/i))) {
            this.setStatistic(result, seen, "countMiss", this.parseInteger(match[1]!, "Miss count"), "Miss count");
            return;
        }

        if ((match = token.match(/^((?:\d+(?:\.\d+)?)|(?:\.\d+))%$/))) {
            this.setOnce(seen, "accuracy", "Accuracy", () => {
                result.accuracy = this.parseNumber(match![1]!, "Accuracy", 0, 100) / 100;
            });

            return;
        }

        if ((match = token.match(/^((?:\d+(?:\.\d+)?)|(?:\.\d+))\*$/))) {
            this.setOnce(seen, "clockRate", "Clock rate", () => {
                result.clockRate = this.parseNumber(
                    match![1]!,
                    "Clock rate",
                    this.minimumClockRate,
                    this.maximumClockRate,
                );
            });

            return;
        }

        if ((match = token.match(/^(\d+)x$/i))) {
            this.setOnce(seen, "combo", "Combo", () => {
                result.combo = this.parseInteger(match![1]!, "Combo");
            });

            return;
        }

        if ((match = token.match(/^(ar|cs|od|hp)((?:\d+(?:\.\d+)?)|(?:\.\d+))$/i))) {
            const attribute = match[1]!.toLowerCase() as TAttributeName;

            this.setAttribute(result, seen, attribute, this.parseNumber(match[2]!, attribute.toUpperCase(), 0, 11));

            return;
        }

        throw new Exception(EApplicationError.INPUT_ERROR, `Unknown simulation parameter: \`${token}\`.`);
    }

    private static parseQuery(
        query: SimulateQueryDto,
        mode: GameMode,
        result: ISimulateParameters,
        seen: Set<string>,
    ): void {
        this.setQueryValue(query.accuracy, seen, "accuracy", "Accuracy", (value) => {
            result.accuracy = value / 100;
        });

        this.setQueryValue(query.combo, seen, "combo", "Combo", (value) => {
            result.combo = value;
        });

        this.setQueryValue(query.clockRate, seen, "clockRate", "Clock rate", (value) => {
            result.clockRate = value;
        });

        this.setQueryValue(query.bpm, seen, "bpm", "BPM", (value) => {
            result.bpm = value;
        });

        this.setQueryValue(query.n300, seen, "count300", "300 count", (value) => {
            result.statistics.count300 = value;
        });

        this.setQueryValue(query.n100, seen, "count100", "100 count", (value) => {
            result.statistics.count100 = value;
        });

        if (query.n50?.some()) {
            this.requireMode(mode, [GameMode.Standard, GameMode.Catch, GameMode.Mania], "50 count");

            this.setQueryValue(query.n50, seen, "count50", "50 count", (value) => {
                result.statistics.count50 = value;
            });
        }

        this.setQueryValue(query.misses, seen, "countMiss", "Miss count", (value) => {
            result.statistics.countMiss = value;
        });

        if (query.gekis?.some()) {
            this.requireMode(mode, [GameMode.Mania], "Gekis");

            this.setQueryValue(query.gekis, seen, "countGeki", "Geki count", (value) => {
                result.statistics.countGeki = value;
            });
        }

        if (query.katus?.some()) {
            this.requireMode(mode, [GameMode.Catch, GameMode.Mania], "Katus");

            this.setQueryValue(query.katus, seen, "countKatu", "Katu count", (value) => {
                result.statistics.countKatu = value;
            });
        }

        if (query.sliderEnds?.some()) {
            this.requireMode(mode, [GameMode.Standard], "Slider ends");

            this.setQueryValue(query.sliderEnds, seen, "countSliderTailMisses", "Slider ends", (value) => {
                result.statistics.countSliderTailMisses = value;
            });
        }

        if (query.largeTicks?.some()) {
            this.requireMode(mode, [GameMode.Standard], "Large ticks");

            this.setQueryValue(query.largeTicks, seen, "countLargeTickMisses", "Large ticks", (value) => {
                result.statistics.countLargeTickMisses = value;
            });
        }

        if (query.smallTicks?.some()) {
            this.requireMode(mode, [GameMode.Catch], "Small ticks");

            this.setQueryValue(query.smallTicks, seen, "count50", "Small ticks", (value) => {
                result.statistics.count50 = value;
            });
        }

        this.setQueryValue(query.score, seen, "legacyTotalScore", "Score", (value) => {
            result.legacyTotalScore = value;
        });

        this.setQueryValue(query.ar, seen, "ar", "AR", (value) => {
            result.attributes.ar = value;
        });

        this.setQueryValue(query.cs, seen, "cs", "CS", (value) => {
            result.attributes.cs = value;
        });

        this.setQueryValue(query.od, seen, "od", "OD", (value) => {
            result.attributes.od = value;
        });

        this.setQueryValue(query.hp, seen, "hp", "HP", (value) => {
            result.attributes.hp = value;
        });

        const hasLazer = query.lazer?.some() ?? false;
        const hasStable = query.stable?.some() ?? false;

        if (hasLazer && hasStable) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Specify either `lazer` or `stable`, not both.");
        }

        if (hasLazer) {
            this.setOnce(seen, "scoringMode", "Scoring mode", () => {
                result.scoringMode = query.lazer.unwrap() ? ESimulateScoringMode.Lazer : ESimulateScoringMode.Stable;
            });
        }

        if (hasStable) {
            this.setOnce(seen, "scoringMode", "Scoring mode", () => {
                result.scoringMode = query.stable.unwrap() ? ESimulateScoringMode.Stable : ESimulateScoringMode.Lazer;
            });
        }
    }

    private static validateResult(result: ISimulateParameters): void {
        if (result.clockRate !== undefined && result.bpm !== undefined) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Specify either `clockrate` or `bpm`, not both.");
        }

        if (result.legacyTotalScore !== undefined && result.scoringMode === ESimulateScoringMode.Lazer) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Score can only be specified with stable scoring.");
        }

        if (result.legacyTotalScore !== undefined) {
            result.scoringMode ??= ESimulateScoringMode.Stable;
        }

        const hasNestedStandardStatistics =
            result.statistics.countSliderTailMisses !== undefined ||
            result.statistics.countLargeTickMisses !== undefined;

        if (hasNestedStandardStatistics && result.scoringMode === ESimulateScoringMode.Stable) {
            throw new Exception(
                EApplicationError.INPUT_ERROR,
                "Slider ends and large ticks can only be specified with lazer scoring.",
            );
        }
    }

    private static setAttribute(
        result: ISimulateParameters,
        seen: Set<string>,
        attribute: TAttributeName,
        value: number,
    ): void {
        this.setOnce(seen, attribute, attribute.toUpperCase(), () => {
            result.attributes[attribute] = value;
        });
    }

    private static setStatistic(
        result: ISimulateParameters,
        seen: Set<string>,
        statistic: TStatisticName,
        value: number,
        label: string,
    ): void {
        this.setOnce(seen, statistic, label, () => {
            result.statistics[statistic] = value;
        });
    }

    private static setQueryValue<T>(
        option: CommandOption<T> | undefined,
        seen: Set<string>,
        key: string,
        label: string,
        setter: (value: T) => void,
    ): void {
        if (!option?.some()) {
            return;
        }

        this.setOnce(seen, key, label, () => setter(option.unwrap()));
    }

    private static setOnce(seen: Set<string>, key: string, label: string, setter: () => void): void {
        if (seen.has(key)) {
            throw new Exception(EApplicationError.INPUT_ERROR, `${label} was specified more than once.`);
        }

        seen.add(key);
        setter();
    }

    private static assignDefined<T extends object, K extends keyof T>(
        target: T,
        key: K,
        value: T[K] | undefined,
    ): void {
        if (value !== undefined) {
            target[key] = value;
        }
    }

    private static parseNumber(input: string, label: string, minimum: number, maximum: number): number {
        const value = Number(input);

        if (!Number.isFinite(value) || value < minimum || value > maximum) {
            throw new Exception(EApplicationError.INPUT_ERROR, `${label} must be between ${minimum} and ${maximum}.`);
        }

        return value;
    }

    private static parseInteger(input: string, label: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
        const value = Number(input);

        if (!Number.isSafeInteger(value)) {
            throw new Exception(EApplicationError.INPUT_ERROR, `${label} must be a valid integer.`);
        }

        if (value < minimum || value > maximum) {
            throw new Exception(EApplicationError.INPUT_ERROR, `${label} must be between ${minimum} and ${maximum}.`);
        }

        return value;
    }

    private static requireMode(actualMode: GameMode, allowedModes: ReadonlyArray<GameMode>, label: string): void {
        if (!allowedModes.includes(actualMode)) {
            throw new Exception(EApplicationError.INPUT_ERROR, `${label} cannot be specified for this game mode.`);
        }
    }
}
