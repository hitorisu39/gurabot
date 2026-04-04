import { Import, IsEnum, Option, Subcommand } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { UserService } from "@/modules/user/User.service";
import { CommandOption } from "@domain/core/Command";
import { EScoreListSize } from "@domain/osu/enums/Score.enum";
import { UserConfigUpdateDto } from "@domain/user/User.dto";

@Subcommand({
    root: "config",
    name: "user",
    description: "Configuration for your user defaults.",
})
export class ConfigUserSubcommand extends AbstractCommand {
    @Import() declare private readonly userService: UserService;

    @Option("score_list_size", "Specify the default size for score lists (detailed/compact).")
    @IsEnum(EScoreListSize)
    declare private readonly scoreListSize: CommandOption<EScoreListSize>;

    public async execute(ctx: CommandContext): Promise<void> {
        const updates: UserConfigUpdateDto = {};

        if (this.scoreListSize.some()) {
            updates.scoreListSize = this.scoreListSize.unwrap();
        }

        await this.userService.update(ctx.author.id, updates);
        await ctx.respond(Embed.success("Your user configuration was updated."));
    }
}
