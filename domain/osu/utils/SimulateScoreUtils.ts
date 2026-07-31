import { HitResultResponse, PerformanceRequest } from "@generated/calculator/calculator";
import { ModUtils, ParsedMod } from "@generated/adapter/mods";
import { GameMode } from "@generated/adapter/types";
import { ESimulateScoringMode } from "../enums/Simulate.enum";
import { SimulateViewDto } from "../views/Simulate.view";

export class SimulateScoreUtils {
    public static calculationMods(data: SimulateViewDto): Array<ParsedMod> {
        const mods = data.mods.filter((mod) => mod.acronym !== "DA");

        if (this.hasAttributeOverrides(data)) {
            mods.push(this.difficultyAdjustMod(data));
        }

        if (data.scoringMode === ESimulateScoringMode.Stable) {
            mods.push(this.classicMod());
        }

        return mods;
    }

    public static buildScoreState(data: SimulateViewDto, combo: number): PerformanceRequest["score"] {
        const score: PerformanceRequest["score"] = {
            maxCombo: combo,
        };

        if (data.accuracy !== undefined) score.accuracy = data.accuracy;

        const statistics = data.statistics;

        if (statistics.count300 !== undefined) score.count300 = statistics.count300;
        if (statistics.count100 !== undefined) score.count100 = statistics.count100;
        if (statistics.count50 !== undefined) score.count50 = statistics.count50;
        if (statistics.countGeki !== undefined) score.countGeki = statistics.countGeki;
        if (statistics.countKatu !== undefined) score.countKatu = statistics.countKatu;
        if (statistics.countMiss !== undefined) score.countMiss = statistics.countMiss;

        if (data.scoringMode === ESimulateScoringMode.Lazer && this.getMode(data) === GameMode.Standard) {
            // Explicit zeroes make the original permissive calculator return
            // full slider-tail and large-tick hits by default.
            score.countLargeTickMisses = statistics.countLargeTickMisses ?? 0;
            score.countSliderTailMisses = statistics.countSliderTailMisses ?? 0;
        }

        return score;
    }

    public static buildFullComboScore(
        hitResults: HitResultResponse,
        mode: GameMode,
        maxCombo: number,
    ): PerformanceRequest["score"] {
        const score: PerformanceRequest["score"] = {
            maxCombo,
            countMiss: 0,
        };

        switch (mode) {
            case GameMode.Standard:
                score.count300 = hitResults.count300 + hitResults.countMiss;
                score.count100 = hitResults.count100;
                score.count50 = hitResults.count50;
                score.countLargeTickMisses = 0;
                score.countSliderTailMisses = 0;
                break;

            case GameMode.Taiko:
                score.count300 = hitResults.count300 + hitResults.countMiss;
                score.count100 = hitResults.count100;
                break;

            case GameMode.Catch:
                score.count300 = hitResults.count300 + hitResults.countMiss;
                score.count100 = hitResults.count100;
                score.count50 = hitResults.count50;
                score.countKatu = hitResults.countKatu;
                break;

            case GameMode.Mania:
                score.countGeki = hitResults.countGeki + hitResults.countMiss;
                score.count300 = hitResults.count300;
                score.countKatu = hitResults.countKatu;
                score.count100 = hitResults.count100;
                score.count50 = hitResults.count50;
                break;
        }

        return score;
    }

    public static hasAttributeOverrides(data: SimulateViewDto): boolean {
        return Object.values(data.attributes).some((value) => value !== undefined);
    }

    public static hasManualHitCounts(data: SimulateViewDto): boolean {
        const statistics = data.statistics;

        switch (this.getMode(data)) {
            case GameMode.Standard:
                return [statistics.count300, statistics.count100, statistics.count50].some(
                    (value) => value !== undefined,
                );

            case GameMode.Taiko:
                return [statistics.count300, statistics.count100].some((value) => value !== undefined);

            case GameMode.Catch:
                return [statistics.count300, statistics.count100, statistics.count50].some(
                    (value) => value !== undefined,
                );

            case GameMode.Mania:
                return [
                    statistics.countGeki,
                    statistics.count300,
                    statistics.countKatu,
                    statistics.count100,
                    statistics.count50,
                ].some((value) => value !== undefined);
        }
    }

    public static clearManualHitCounts(data: SimulateViewDto): void {
        const statistics = data.statistics;

        switch (this.getMode(data)) {
            case GameMode.Standard:
                statistics.count300 = undefined;
                statistics.count100 = undefined;
                statistics.count50 = undefined;
                break;

            case GameMode.Taiko:
                statistics.count300 = undefined;
                statistics.count100 = undefined;
                break;

            case GameMode.Catch:
                statistics.count300 = undefined;
                statistics.count100 = undefined;
                statistics.count50 = undefined;
                break;

            case GameMode.Mania:
                statistics.countGeki = undefined;
                statistics.count300 = undefined;
                statistics.countKatu = undefined;
                statistics.count100 = undefined;
                statistics.count50 = undefined;
                break;
        }
    }

    public static getMode(data: SimulateViewDto): GameMode {
        return data.beatmapset.beatmaps?.find((beatmap) => beatmap.id === data.beatmapID)?.mode ?? GameMode.Standard;
    }

    private static classicMod(): ParsedMod {
        return (
            ModUtils.parse(["CL"])[0] ??
            ({
                acronym: "CL",
                name: "Classic",
                type: "Conversion",
            } as ParsedMod)
        );
    }

    private static difficultyAdjustMod(data: SimulateViewDto): ParsedMod {
        const settings: Record<string, number> = {};

        if (data.attributes.cs !== undefined) settings.circle_size = data.attributes.cs;
        if (data.attributes.ar !== undefined) settings.approach_rate = data.attributes.ar;
        if (data.attributes.od !== undefined) settings.overall_difficulty = data.attributes.od;
        if (data.attributes.hp !== undefined) settings.drain_rate = data.attributes.hp;

        const parsed = ModUtils.parse([{ acronym: "DA", settings }])[0];
        if (parsed) return parsed;

        return {
            acronym: "DA",
            name: "Difficulty Adjust",
            type: "Conversion",
            settings,
        } as ParsedMod;
    }
}
