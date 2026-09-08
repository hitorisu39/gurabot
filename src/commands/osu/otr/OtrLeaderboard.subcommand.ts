import { Import, IsEnum, IsInteger, IsString, Option, Subcommand } from "@/core/decorators";
import { AbstractSessionCommand } from "@/commands/AbstractSessionCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { OtrLeaderboardViewService } from "@/modules/otr/views/OtrLeaderboardView.service";
import { CommandOption } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { EOtrRuleset } from "@domain/otr/enums/Otr.enum";
import { EOtrLeaderboardKeys } from "@domain/otr/configs/OtrLeaderboard.config";
import { OtrLeaderboardViewDto } from "@domain/otr/views/OtrLeaderboard.view";
import { GameMode } from "@generated/adapter/types";

@Subcommand({
    root: "otr",
    name: "leaderboard",
    description: "Shows the o!TR tournament rating leaderboard.",
})
export class OtrLeaderboardSubcommand extends AbstractSessionCommand {
    @Import() declare private readonly leaderboardViewService: OtrLeaderboardViewService;

    @Option("mode", "Specify the game mode")
    @IsEnum(GameMode)
    declare private readonly mode: CommandOption<GameMode>;

    @Option("keys", "Select 4K or 7K when mode is mania; otherwise mania uses the other-key leaderboard.")
    @IsEnum(EOtrLeaderboardKeys)
    declare private readonly keys: CommandOption<EOtrLeaderboardKeys>;

    @Option("country", "Filter by a two-letter country code, such as PL or US.")
    @IsString()
    declare private readonly country: CommandOption<string>;

    @Option("page", "Leaderboard page to display.")
    @IsInteger(1)
    declare private readonly page: CommandOption<number>;

    public async execute(ctx: CommandContext): Promise<void> {
        const mode = this.mode.some() ? this.mode.unwrap() : GameMode.Standard;

        const keys = this.keys.some() ? this.keys.unwrap() : undefined;
        if (keys !== undefined && mode !== GameMode.Mania) {
            throw new Exception(EApplicationError.INPUT_ERROR, "The keys option requires mode=mania.");
        }

        const country = this.country.some() ? this.country.unwrap().trim().toUpperCase() : undefined;
        if (country !== undefined && !/^[A-Z]{2}$/.test(country)) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Use a two-letter country code, such as PL or US.");
        }

        const rulesets: Record<GameMode, EOtrRuleset> = {
            [GameMode.Standard]: EOtrRuleset.Standard,
            [GameMode.Taiko]: EOtrRuleset.Taiko,
            [GameMode.Catch]: EOtrRuleset.Catch,
            [GameMode.Mania]:
                keys === EOtrLeaderboardKeys.FourK
                    ? EOtrRuleset.Mania4K
                    : keys === EOtrLeaderboardKeys.SevenK
                      ? EOtrRuleset.Mania7K
                      : EOtrRuleset.Mania,
        };

        const data: OtrLeaderboardViewDto = {
            timestamp: Date.now(),
            authorID: ctx.author.id,
            ruleset: rulesets[mode],
            country,
            page: this.page.some() ? this.page.unwrap() : 1,
            response: null,
        };

        await this.leaderboardViewService.prepare(data);
        await this.respondWithSession(ctx, "otr_leaderboard_view", data, this.leaderboardViewService);
    }
}
