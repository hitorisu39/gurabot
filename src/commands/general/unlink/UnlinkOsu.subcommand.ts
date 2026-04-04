import { Import, IsEnum, Option, Subcommand } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { UserService } from "@/modules/user/User.service";
import { AdapterProvider } from "@generated/adapter/types";
import { OsuService } from "@/modules/osu/Osu.service";
import { ProviderMeta } from "@generated/adapter";
import { CommandOption } from "@domain/core/Command";

@Subcommand({
    root: "unlink",
    name: "osu",
    description: "All your data will be erased if server option is not set.",
    ephemeral: true,
})
export class UnlinkOsuSubcommand extends AbstractCommand {
    @Import() declare private readonly userService: UserService;
    @Import() declare private readonly osuService: OsuService;

    @Option("server", "Specify a server to link to")
    @IsEnum(AdapterProvider)
    declare private readonly server: CommandOption<AdapterProvider>;

    public async execute(ctx: CommandContext): Promise<void> {
        await this.userService.unlink(ctx.author.id, this.server.unwrapUnchecked());

        if (this.server.some()) {
            await ctx.respond(
                Embed.success(`You were unlinked from the bot on ${ProviderMeta[this.server.unwrap()].name}`),
            );
            return;
        }

        await ctx.respond(Embed.success(`You were unlinked from the bot. All your data was erased.`));
    }
}
