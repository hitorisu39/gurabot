import { Aliases, Category, Examples, Help, Import, InjectToken, IsString, Option, Required } from "@/core/decorators";
import { CommandOption, ECommandCategory } from "@domain/core/Command";
import { AbstractPpTargetCommand, TResolvedPpTarget } from "./AbstractPpTargetCommand";
import { RankTargetParser } from "@domain/osu/utils/RankTargetParser";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { AdapterProvider, GameMode } from "@generated/adapter/types";
import { RankPpResolverService } from "@/modules/osu/reach/RankPpResolver.service";

@Help(`
    Calculates the plays required for a player to reach a target global or country rank.
    
    Global ranks can be provided as "5000" or "#5000".
    Country ranks can be provided as "KR50" or "KR#50".

    Use "plays" to specify how many new plays should be used.
    Use "each" to specify how much each new play should be worth.
    "plays" and "each" cannot be used together.
`)
@Examples("rank 5000", "rank KR50", "rank KR#50 plays=5", "rank 1000 each=600 WhiteCat")
@Category(ECommandCategory.Osu)
export abstract class AbstractRankCommand extends AbstractPpTargetCommand {
    @Import() declare private readonly rankPpResolverService: RankPpResolverService;

    @Option("rank", "Target global or country rank")
    @InjectToken()
    @IsString()
    @Aliases("target")
    @Required()
    declare private readonly rank: CommandOption<string>;

    protected async resolvePpTarget(mode: GameMode, provider: AdapterProvider): Promise<TResolvedPpTarget> {
        const parsed = RankTargetParser.parse(this.rank.unwrap());
        if (!parsed) {
            throw new Exception(
                EApplicationError.INPUT_ERROR,
                'Provide a valid rank such as "5000", "#5000", "KR50", or "KR#50".',
            );
        }
        const resolved = await this.rankPpResolverService.resolve(parsed.rank, mode, provider, parsed.countryCode);

        return {
            type: "rank",
            resolution: resolved,
        };
    }
}
