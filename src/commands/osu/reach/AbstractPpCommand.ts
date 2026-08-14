import { Aliases, Category, Examples, Help, InjectMatch, IsNumber, Option, Required } from "@/core/decorators";
import { CommandMatcher, CommandOption, ECommandCategory } from "@domain/core/Command";
import { AbstractPpTargetCommand, TResolvedPpTarget } from "./AbstractPpTargetCommand";

@Help(`
    Calculates the plays required for a player to reach a target amount of pp.
    Use "plays" to specify how many new plays should be used.
    Use "each" to specify how much each new play should be worth.
    "plays" and "each" cannot be used together.
`)
@Examples("pp 12000", "pp 12000 WhiteCat", "pp 12000 plays=5 WhiteCat", "pp 12000 each=600 WhiteCat")
@Category(ECommandCategory.Osu)
export abstract class AbstractPpCommand extends AbstractPpTargetCommand {
    @Option("pp", "Target total PP")
    @Required()
    @IsNumber(0, 99999)
    @InjectMatch(CommandMatcher.number)
    @Aliases("target")
    declare private readonly pp: CommandOption<number>;

    protected async resolvePpTarget(): Promise<TResolvedPpTarget> {
        return {
            type: "pp",
            pp: this.pp.unwrap(),
        };
    }
}
