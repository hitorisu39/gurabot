import { IsEnum, Option } from "@/core/decorators";
import { CommandOption } from "@domain/core/Command";
import { AbstractOsekaiRankingCommand } from "./AbstractOsekaiRankingCommand";
import { EOsekaiAllModeRankingType, EOsekaiRanking } from "@domain/osekai/enums/OsekaiRanking.enum";

export abstract class AbstractOsekaiAllModeRankingCommand extends AbstractOsekaiRankingCommand {
    @Option("type", "Specify how the all-mode value should be calculated")
    @IsEnum(EOsekaiAllModeRankingType)
    declare private readonly type: CommandOption<EOsekaiAllModeRankingType>;

    protected abstract readonly standardDeviationRanking: EOsekaiRanking;
    protected abstract readonly totalRanking: EOsekaiRanking;

    protected getRanking(): EOsekaiRanking {
        const type = this.type.unwrapOr(EOsekaiAllModeRankingType.StandardDeviation);
        return type === EOsekaiAllModeRankingType.Total ? this.totalRanking : this.standardDeviationRanking;
    }
}
