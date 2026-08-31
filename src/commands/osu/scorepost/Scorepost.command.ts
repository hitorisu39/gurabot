import { CommandContext } from "@/core/discord/context/CommandContext";
import { Aliases, Category, Command, Import, Inject, InjectMatch, IsNumber, IsString, Option } from "@/core/decorators";
import { CommandMatcher, CommandOption, ECommandCategory } from "@domain/core/Command";
import { ScoreResolverService } from "@/modules/osu/ScoreResolver.service";
import { ScorepostService } from "@/modules/osu/scorepost/Scorepost.service";
import { ScorepostViewService } from "@/modules/osu/scorepost/ScorepostView.service";
import { scoreUrlRegex } from "@domain/osu/configs/Score.config";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { isTimezoneOffset, normalizeTimezone, parseTimezoneOffset } from "@domain/utils/dateTimeUtils";

@Category(ECommandCategory.Osu)
@Command({
    name: "scorepost",
    description: "Generates an osu!standard scorepost.",
    aliases: ["post"],
})
export class ScorepostCommand extends AbstractCommand {
    @Import() declare private readonly scoreResolverService: ScoreResolverService;
    @Import() declare private readonly scorepostService: ScorepostService;
    @Import() declare private readonly scorepostViewService: ScorepostViewService;

    @Option("score", "Specify an osu! score URL or ID.")
    @IsString()
    @InjectMatch((value) => scoreUrlRegex.test(value))
    declare private readonly score: CommandOption<string>;

    @Option("text", "Specify text to put after main score info.")
    @IsString()
    @Inject()
    declare private readonly text: CommandOption<string>;

    @Option("ur", "Specify the NON CV. unstable rate to display.")
    @IsNumber()
    @InjectMatch(CommandMatcher.unsignedNumber)
    declare private readonly ur: CommandOption<number>;

    @Option("timezone", "UTC offset used for play times, e.g. +3 or -05:30. Defaults to UTC+0.")
    @IsString(1, 9)
    @Aliases("tz")
    @InjectMatch(isTimezoneOffset)
    declare private readonly timezone: CommandOption<string>;

    public async execute(ctx: CommandContext): Promise<void> {
        const scoreID = await this.scoreResolverService.resolveCommandTarget(ctx, this.score);

        const text = this.text.unwrapUnchecked();
        const ur = this.ur.unwrapUnchecked();
        const timezone = normalizeTimezone(this.timezone.unwrapUnchecked());
        const timezoneOffset = parseTimezoneOffset(timezone);

        const data = await this.scorepostService.resolve(scoreID, ur, text, timezoneOffset);
        await ctx.respond(await this.scorepostViewService.build(data));
    }
}
