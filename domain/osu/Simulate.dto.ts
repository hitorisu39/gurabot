import { Aliases, Inject, IsBoolean, IsInteger, IsNumber, IsString, Option } from "@/core/decorators";
import { CommandOption } from "@domain/core/Command";

export class SimulateQueryDto {
    @Option("input", "Positional simulation parameters")
    @Inject()
    @IsString()
    declare input: CommandOption<string>;

    @Option("acc", "Specify accuracy")
    @Aliases("accuracy")
    @IsNumber(0, 100)
    declare accuracy: CommandOption<number>;

    @Option("combo", "Specify combo")
    @IsInteger(0, 999999)
    declare combo: CommandOption<number>;

    @Option("clockrate", "Specify clock rate")
    @Aliases("rate")
    @IsNumber(0.1, 10)
    declare clockRate: CommandOption<number>;

    @Option("bpm", "Specify BPM")
    @IsNumber(1, 99999)
    declare bpm: CommandOption<number>;

    @Option("n300", "Specify 300 count")
    @IsInteger(0, 999999)
    declare n300: CommandOption<number>;

    @Option("n100", "Specify 100 count")
    @IsInteger(0, 999999)
    declare n100: CommandOption<number>;

    @Option("n50", "Specify 50 count")
    @IsInteger(0, 999999)
    declare n50: CommandOption<number>;

    @Option("miss", "Specify misses")
    @Aliases("misses")
    @IsInteger(0, 999999)
    declare misses: CommandOption<number>;

    @Option("gekis", "Specify gekis / 320s")
    @Aliases("geki", "n320")
    @IsInteger(0, 999999)
    declare gekis: CommandOption<number>;

    @Option("katus", "Specify katus / 200s")
    @Aliases("katu", "n200")
    @IsInteger(0, 999999)
    declare katus: CommandOption<number>;

    @Option("sliderends", "Specify missed slider ends")
    @IsInteger(0, 999999)
    declare sliderEnds: CommandOption<number>;

    @Option("largeticks", "Specify missed large ticks")
    @IsInteger(0, 999999)
    declare largeTicks: CommandOption<number>;

    @Option("smallticks", "Specify small ticks")
    @IsInteger(0, 999999)
    declare smallTicks: CommandOption<number>;

    @Option("score", "Specify stable score")
    @IsInteger(0, Number.MAX_SAFE_INTEGER)
    declare score: CommandOption<number>;

    @Option("ar", "Override AR")
    @IsNumber(0, 11)
    declare ar: CommandOption<number>;

    @Option("cs", "Override CS")
    @IsNumber(0, 11)
    declare cs: CommandOption<number>;

    @Option("od", "Override OD")
    @IsNumber(0, 11)
    declare od: CommandOption<number>;

    @Option("hp", "Override HP")
    @IsNumber(0, 11)
    declare hp: CommandOption<number>;

    @Option("lazer", "Use lazer scoring")
    @IsBoolean()
    declare lazer: CommandOption<boolean>;

    @Option("stable", "Use stable scoring")
    @IsBoolean()
    declare stable: CommandOption<boolean>;
}
