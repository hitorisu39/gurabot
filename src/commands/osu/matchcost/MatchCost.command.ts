import {
    Aliases,
    Category,
    Command,
    Examples,
    Help,
    Import,
    InjectMatch,
    IsInteger,
    IsNumber,
    IsString,
    Option,
    Required,
} from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { CommandMatcher, CommandOption, ECommandCategory } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { MultiplayerTargetParser } from "@domain/osu/utils/MultiplayerTargetParser";
import { MatchCostViewDto } from "@domain/osu/views/MatchCost.view";
import { MatchCostMultiplayerResolverService } from "@/modules/osu/matchcost/MatchCostMultiplayerResolver.service";
import { MatchCostViewService } from "@/modules/osu/matchcost/MatchCostView.service";
import { MatchCostEvaluatorService } from "@/modules/osu/matchcost/MatchCostEvaluator.service";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";

@Help(`
    Calculates match cost for an osu! match or lazer room.

    **How it works**
    Scores are compared against the lobby average for each round.
    Consistent participation helps slightly, while low-sample performances are pulled closer to average.
    In Team VS, strong scores gain extra value when they were important to winning the round.
    An inferred tiebreaker is weighted slightly more.
    Easy scores use the configured \`ez\` multiplier before calculations.

    **Round Exclusions**
    \`warmups\`: excludes rounds from the beginning and defaults to \`2\`.
    \`skip\`: excludes rounds from the end and defaults to \`0\`.

    See the source code for the exact formula and weighting.
`)
@Examples("mc https://osu.ppy.sh/community/matches/111555364 0", "mc https://osu.ppy.sh/multiplayer/rooms/3824813 0")
@Category(ECommandCategory.Osu)
@Command({
    name: "matchcost",
    description: "Calculates match cost for an osu! match.",
    aliases: ["mc", "matchcosts"],
})
export class MatchCostCommand extends AbstractCommand {
    @Import() declare private readonly multiplayerResolver: MatchCostMultiplayerResolverService;
    @Import() declare private readonly matchCostEvaluatorService: MatchCostEvaluatorService;
    @Import() declare private readonly matchCostViewService: MatchCostViewService;

    @Option("mp", "Specify an osu! match or room link.")
    @IsString()
    @InjectMatch((value) => MultiplayerTargetParser.test(value))
    @Required()
    declare private readonly mp: CommandOption<string>;

    @Option("warmups", "Number of warmup rounds to exclude.")
    @Aliases("warmup", "wu")
    @IsInteger(0, 10)
    @InjectMatch(CommandMatcher.integer)
    declare private readonly warmups: CommandOption<number>;

    @Option("ez", "Score multiplier applied to plays using Easy mod.")
    @Aliases("ezmultiplier", "ezmulti")
    @IsNumber(0, 100)
    declare private readonly ezMultiplier: CommandOption<number>;

    @Option("skip", "Number of rounds to exclude from the end.")
    @IsInteger(0, 10)
    declare private readonly skip: CommandOption<number>;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = MultiplayerTargetParser.parse(this.mp.unwrap());
        if (!target) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Provide a valid osu! match or room link.");
        }

        const warmups = this.warmups.unwrapOr(2);
        const skip = this.skip.unwrapOr(0);
        const ezMultiplier = this.ezMultiplier.unwrapOr(1.78);

        const match = await this.multiplayerResolver.resolve(target);

        if (warmups + skip >= match.games.length) {
            throw new Exception(
                EApplicationError.INPUT_ERROR,
                `The match only has ${match.games.length} completed ${DiscordFormatter.plural(match.games.length, "round")}, so excluding ${warmups} from the beginning and ${skip} from the end would leave nothing to evaluate.`,
            );
        }

        const calculation = this.matchCostEvaluatorService.evaluate(match, warmups, skip, ezMultiplier);
        if (!calculation.players.length) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                "No multiplayer scores are available after excluding warmups.",
            );
        }

        const data: MatchCostViewDto = {
            id: match.id,
            type: match.type,
            name: match.name,
            ended: match.ended,
            warmups,
            skip,
            ezMultiplier,
            calculation,
        };

        await ctx.respond(this.matchCostViewService.build(data));
    }
}
