import { IsDateRange, IsRange, IsString, Option } from "@/core/decorators";
import type { IPerformanceCalculationResponse } from "@domain/core/Calculator";
import { CommandOption, ICommandDateRange, ICommandRange } from "@domain/core/Command";
import { Beatmap, Beatmapset, GameMode, Score } from "@generated/adapter/types";
import { Exclude, Expose, Type } from "class-transformer";
import { EPersonalBestCase } from "./enums/Score.enum";

@Exclude()
export class PersonalBestPlacementDto {
    /**
     * Zero-based index. Formatting adds one when displaying the rank.
     */
    @Expose()
    declare index: number;

    @Expose()
    declare case: EPersonalBestCase;
}

@Exclude()
export class ScoreWithPlacement extends Score {
    @Expose()
    @Type(() => PersonalBestPlacementDto)
    declare personalBest?: PersonalBestPlacementDto;

    /**
     * Zero-based global leaderboard index.
     */
    @Expose()
    declare globalTop?: number;
}

@Exclude()
export class ScoreWithMaps extends ScoreWithPlacement {
    @Expose()
    @Type(() => Beatmap)
    declare beatmap: Beatmap;

    @Expose()
    @Type(() => Beatmapset)
    declare beatmapset: Beatmapset;
}

@Exclude()
export class PopulatedScore<M extends GameMode = GameMode> extends ScoreWithMaps {
    @Expose()
    declare calculated: IPerformanceCalculationResponse<M>;

    @Expose()
    declare calculatedFC?: IPerformanceCalculationResponse<M>;
}

@Exclude()
export class PopulatedScoreAverageFieldDto {
    @Expose()
    declare min: number;

    @Expose()
    declare avg: number;

    @Expose()
    declare max: number;
}

@Exclude()
export class PopulatedScoreAverageDto {
    @Expose()
    @Type(() => PopulatedScoreAverageFieldDto)
    declare pp: PopulatedScoreAverageFieldDto;

    @Expose()
    @Type(() => PopulatedScoreAverageFieldDto)
    declare combo: PopulatedScoreAverageFieldDto;

    @Expose()
    @Type(() => PopulatedScoreAverageFieldDto)
    declare length: PopulatedScoreAverageFieldDto;

    @Expose()
    @Type(() => PopulatedScoreAverageFieldDto)
    declare accuracy: PopulatedScoreAverageFieldDto;

    @Expose()
    @Type(() => PopulatedScoreAverageFieldDto)
    declare bpm: PopulatedScoreAverageFieldDto;

    @Expose()
    @Type(() => PopulatedScoreAverageFieldDto)
    declare ar: PopulatedScoreAverageFieldDto;

    @Expose()
    @Type(() => PopulatedScoreAverageFieldDto)
    declare od: PopulatedScoreAverageFieldDto;

    @Expose()
    @Type(() => PopulatedScoreAverageFieldDto)
    declare cs: PopulatedScoreAverageFieldDto;

    @Expose()
    @Type(() => PopulatedScoreAverageFieldDto)
    declare hp: PopulatedScoreAverageFieldDto;

    @Expose()
    @Type(() => PopulatedScoreAverageFieldDto)
    declare miss: PopulatedScoreAverageFieldDto;

    @Expose()
    @Type(() => PopulatedScoreAverageFieldDto)
    declare stars: PopulatedScoreAverageFieldDto;
}

@Exclude()
export class ScoreModStatistics {
    @Expose()
    declare individualMods: Array<{ acronym: string; count: number; percentage: number }>;

    @Expose()
    declare modCombos: Array<{ combo: string; count: number; percentage: number }>;

    @Expose()
    declare ppByCombo: Array<{ combo: string; totalWeightedPP: number }>;
}

export class BaseScoreQueryDto {
    @Option("accuracy", "Specify accuracy")
    @IsRange(0, 100)
    declare accuracy: CommandOption<ICommandRange>;

    @Option("combo", "Specify combo")
    @IsRange(0, 99999)
    declare combo: CommandOption<ICommandRange>;

    @Option("misses", "Specify misses")
    @IsRange(0, 99999)
    declare misses: CommandOption<ICommandRange>;

    @Option("score", "Specify score")
    @IsRange()
    declare score: CommandOption<ICommandRange>;

    @Option("date", "Specify accdateuracy")
    @IsDateRange()
    declare date: CommandOption<ICommandDateRange>;
}

export class ScoresWithMapsQueryDto extends BaseScoreQueryDto {
    @Option("artist", "Specify artist")
    @IsString(1, 99)
    declare artist: CommandOption<string>;

    @Option("creator", "Specify mapset creator")
    @IsString(1, 99)
    declare creator: CommandOption<string>;

    @Option("title", "Specify title")
    @IsString(1, 99)
    declare title: CommandOption<string>;

    @Option("version", "Specify version")
    @IsString(1, 99)
    declare version: CommandOption<string>;

    @Option("rankdate", "Specify ranked date")
    @IsDateRange()
    declare rankedDate: CommandOption<ICommandDateRange>;

    @Option("length", "Specify length")
    @IsRange(0, 999999)
    declare length: CommandOption<ICommandRange>;

    @Option("cs", "Specify cs/keys")
    @IsRange(0, 13)
    declare cs: CommandOption<ICommandRange>;

    @Option("ar", "Specify ar")
    @IsRange(0, 13)
    declare ar: CommandOption<ICommandRange>;

    @Option("hp", "Specify hp")
    @IsRange(0, 13)
    declare hp: CommandOption<ICommandRange>;

    @Option("od", "Specify od")
    @IsRange(0, 13)
    declare od: CommandOption<ICommandRange>;

    @Option("bpm", "Specify bpm")
    @IsRange(0, 99999)
    declare bpm: CommandOption<ICommandRange>;
}

export class PopulatedScoresQueryDto extends ScoresWithMapsQueryDto {
    @Option("stars", "Specify stars")
    @IsRange(0, 9999)
    declare stars: CommandOption<ICommandRange>;

    @Option("pp", "Specify pp")
    @IsRange(0, 99999)
    declare pp: CommandOption<ICommandRange>;

    @Option("ppfc", "Specify pp for full combo")
    @IsRange(0, 99999)
    declare ppfc: CommandOption<ICommandRange>;
}
