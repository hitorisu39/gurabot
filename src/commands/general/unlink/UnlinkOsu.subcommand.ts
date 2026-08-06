import { Import, IsEnum, Option, Subcommand } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { UserService } from "@/modules/user/User.service";
import { LinkableAdapterProvider, ProviderMeta } from "@generated/adapter";
import { CommandOption } from "@domain/core/Command";

@Subcommand({
    root: "unlink",
    name: "osu",
    description: "All your data will be erased if the server option is not set.",
    ephemeral: true,
})
export class UnlinkOsuSubcommand extends AbstractCommand {
    @Import() declare private readonly userService: UserService;

    @Option("server", "Specify a server to unlink from")
    @IsEnum(LinkableAdapterProvider)
    declare private readonly server: CommandOption<LinkableAdapterProvider>;

    public async execute(ctx: CommandContext): Promise<void> {
        if (this.server.some()) {
            const provider = this.server.unwrap();
            const providerMeta = ProviderMeta[provider];

            await this.userService.unlinkMany(ctx.author.id, providerMeta.linkTargets);
            await ctx.respond(Embed.success(`You were unlinked from the bot on ${providerMeta.name}.`));

            return;
        }

        await this.userService.unlink(ctx.author.id);
        await ctx.respond(Embed.success("You were unlinked from the bot. All your data was erased."));
    }
}
