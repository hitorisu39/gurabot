import { Category, Examples, Help, InjectToken, IsString, Option, Required } from "@/core/decorators";
import { CommandOption, ECommandCategory } from "@domain/core/Command";
import { AbstractPpTargetCommand, TResolvedPpTarget } from "./AbstractPpTargetCommand";
import { AdapterProvider, GameMode } from "@generated/adapter/types";

@Help(`
    Calculates the plays required to reach another player's pp.
    The first username specifies whose pp should be reached.
    An optional second username specifies the player doing the reaching.
`)
@Examples("reach mrekk", "reach mrekk WhiteCat", 'reach "spaced name" WhiteCat')
@Category(ECommandCategory.Osu)
export abstract class AbstractReachCommand extends AbstractPpTargetCommand {
    @Option("target", "Player whose pp should be reached")
    @IsString()
    @InjectToken()
    @Required()
    declare private readonly reachTarget: CommandOption<string>;

    protected async resolvePpTarget(mode: GameMode, provider: AdapterProvider): Promise<TResolvedPpTarget> {
        const user = await this.osuService.user(this.reachTarget.unwrap(), mode, provider);
        return {
            type: "user",
            user,
        };
    }
}
