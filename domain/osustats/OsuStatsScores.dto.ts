import { ParsedMod } from "@generated/adapter/mods";
import { Exclude, Expose, Transform, Type } from "class-transformer";
import { EOsuStatsScoreSort } from "./enums/OsuStatsScores.enum";
import { ESortOrder } from "@domain/osu/enums/Score.enum";
import { EModMatchType } from "@domain/core/Command";
import { GameMode, Grade, ScoreStatistics } from "@generated/adapter/types";
import { ScoreWithPlacement } from "@domain/osu/Score.dto";
import { osuStatsDate, osuStatsMods, osuStatsStatistics } from "./OsuStats.transform";
import { SerializableDto } from "@domain/core/Data";

@Exclude()
export class OsuStatsScoreDto extends ScoreWithPlacement {
    @Expose()
    @Transform(({ value }) => Number(value ?? 0), { toClassOnly: true })
    declare id: number;

    @Expose()
    @Transform(({ value }) => Number(value ?? 0), { toClassOnly: true })
    declare index: number;

    @Expose()
    @Transform(({ value, obj }) => Number(value ?? obj.score ?? 0), { toClassOnly: true })
    declare classicTotalScore: number;

    @Expose()
    @Transform(({ value, obj }) => Number(value ?? obj.score ?? 0), { toClassOnly: true })
    declare totalScore: number;

    @Expose()
    @Transform(({ value, obj }) => Number(value ?? obj.score ?? 0), { toClassOnly: true })
    declare legacyTotalScore: number;

    @Expose()
    @Type(() => ScoreStatistics)
    declare maximumStatistics?: ScoreStatistics;

    @Expose({
        name: "enabledMods",
    })
    @Transform(({ value }) => osuStatsMods(value), { toClassOnly: true })
    declare mods: Array<ParsedMod>;

    @Expose()
    @Transform(({ value, obj }) => osuStatsStatistics(value, obj), { toClassOnly: true })
    declare statistics: ScoreStatistics;

    @Expose()
    @Transform(({ value, obj }) => Number(value ?? obj.beatmap?.beatmapId ?? 0), { toClassOnly: true })
    declare beatmapID: number;

    @Expose({
        name: "rank",
    })
    declare grade: Grade;

    @Expose({
        name: "userId",
    })
    @Transform(({ value }) => Number(value), { toClassOnly: true })
    declare userID: number;

    @Expose({
        name: "accuracy",
    })
    @Transform(({ value }) => Number(value) / 100, { toClassOnly: true })
    @Transform(({ value }) => Number(value) * 100, { toPlainOnly: true })
    declare accuracy: number;

    @Expose({
        name: "playDate",
    })
    @Transform(({ value }) => osuStatsDate(value), { toClassOnly: true })
    declare endedAt: Date;

    @Expose()
    @Transform(({ value }) => value ?? false, { toClassOnly: true })
    declare replay: boolean;

    @Expose()
    @Transform(({ value }) => value ?? false, { toClassOnly: true })
    declare perfect: boolean;

    @Expose()
    @Transform(({ value }) => value ?? true, { toClassOnly: true })
    declare passed: boolean;

    @Expose({
        name: "maxCombo",
    })
    @Transform(({ value }) => Number(value), { toClassOnly: true })
    declare maxCombo: number;

    @Expose({
        name: "ppValue",
    })
    @Transform(
        ({ value }) => {
            if (value === null || value === undefined || value === "") return undefined;
            const pp = Number(value);
            return Number.isFinite(pp) ? pp : undefined;
        },
        { toClassOnly: true },
    )
    declare pp?: number;

    @Expose({
        name: "position",
    })
    @Transform(
        ({ value }) => {
            if (value === undefined || value === null) {
                return undefined;
            }

            return Math.max(0, Number(value) - 1);
        },
        { toClassOnly: true },
    )
    @Transform(
        ({ value }) => {
            if (value === undefined || value === null) return undefined;
            return Number(value) + 1;
        },
        { toPlainOnly: true },
    )
    declare globalTop?: number;
}

@Exclude()
export class OsuStatsScoresPageDto extends SerializableDto {
    @Expose()
    @Type(() => OsuStatsScoreDto)
    declare scores: Array<OsuStatsScoreDto>;

    @Expose()
    declare total: number;
}

@Exclude()
export class OsuStatsScoresRequestDto {
    @Expose()
    declare username: string;

    @Expose()
    declare mode: GameMode;

    @Expose()
    declare page: number;

    @Expose()
    declare minRank: number;

    @Expose()
    declare maxRank: number;

    @Expose()
    declare minAccuracy: number;

    @Expose()
    declare maxAccuracy: number;

    @Expose()
    declare sort: EOsuStatsScoreSort;

    @Expose()
    declare order: ESortOrder;

    @Expose()
    declare modType?: EModMatchType;

    @Expose()
    declare mods?: string;
}
