import { Import, Subcommand } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { TwitchService } from "@/modules/twitch/Twitch.service";
import { UserService } from "@/modules/user/User.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { AdapterProvider } from "@generated/adapter/types";

@Subcommand({
    root: "unlink",
    name: "twitch",
    description: "Unlink Twitch from your osu! profile.",
    ephemeral: true,
})
export class UnlinkTwitchSubcommand extends AbstractCommand {
    @Import() declare private readonly userService: UserService;
    @Import() declare private readonly twitchService: TwitchService;

    public async execute(ctx: CommandContext): Promise<void> {
        const linked = await this.userService.getLinkedID(ctx.author.id, AdapterProvider.Bancho);
        if (!linked) {
            throw new Exception(EApplicationError.NOT_FOUND, "You don't have a linked osu! account.");
        }

        const removed = await this.twitchService.unlink(linked.osuID);
        if (!removed) {
            throw new Exception(EApplicationError.NOT_FOUND, "Your osu! account doesn't have a linked Twitch account.");
        }

        await ctx.respond(Embed.success("Twitch was successfully unlinked from your osu! account."));
    }
}
