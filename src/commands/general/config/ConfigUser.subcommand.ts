import { Import, IsEnum, Option, Subcommand } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { UserService } from "@/modules/user/User.service";
import { CommandOption } from "@domain/core/Command";
import { EScoreListSize } from "@domain/osu/enums/Score.enum";
import { UserConfigUpdateDto } from "@domain/user/User.dto";
import { AdapterProvider, GameMode } from "@generated/adapter/types";

@Subcommand({
    root: "config",
    name: "user",
    description: "Configuration for your user defaults.",
    ephemeral: true,
})
export class ConfigUserSubcommand extends AbstractCommand {
    @Import() declare private readonly userService: UserService;

    @Option("mode", "Specify your default osu! game mode.")
    @IsEnum(GameMode)
    declare private readonly mode: CommandOption<GameMode>;

    @Option("server", "Specify your default osu! server.")
    @IsEnum(AdapterProvider)
    declare private readonly server: CommandOption<AdapterProvider>;

    @Option("score_list_size", "Specify the default size for score lists (detailed/compact).")
    @IsEnum(EScoreListSize)
    declare private readonly scoreListSize: CommandOption<EScoreListSize>;

    public async execute(ctx: CommandContext): Promise<void> {
        const updates: UserConfigUpdateDto = {};

        if (this.scoreListSize.some()) updates.scoreListSize = this.scoreListSize.unwrap();
        if (this.mode.some()) updates.mode = this.mode.unwrap();
        if (this.server.some()) updates.server = this.server.unwrap();

        await this.userService.update(ctx.author.id, updates);
        await ctx.respond(Embed.success("Your user configuration was updated."));
    }
}
