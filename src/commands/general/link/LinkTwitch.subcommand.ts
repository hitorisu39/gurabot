import { Import, Subcommand } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { UserService } from "@/modules/user/User.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { AdapterProvider } from "@generated/adapter/types";
import { randomBytes } from "crypto";

@Subcommand({
    root: "link",
    name: "twitch",
    description: "Link your Twitch account to your osu! profile.",
    ephemeral: true,
})
export class LinkTwitchSubcommand extends AbstractCommand {
    @Import() declare private readonly userService: UserService;

    public async execute(ctx: CommandContext): Promise<void> {
        const linked = await this.userService.getLinkedID(ctx.author.id, AdapterProvider.Bancho);
        if (!linked) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                "You need to link your osu! account before linking Twitch. Use `/link osu` first.",
            );
        }

        const state = randomBytes(16).toString("hex");
        await this.cache.set("auth_twitch_state", { discord: ctx.author.id, osuID: linked.osuID }, 300, state);

        const params = new URLSearchParams({
            client_id: this.config.twitch.client_id,
            redirect_uri: this.config.twitch.redirect_uri,
            response_type: "code",
            scope: "openid",
            state,
        });

        const oauthUrl = `https://id.twitch.tv/oauth2/authorize?${params}`;
        await ctx.respond(Embed.general(`Please [click here](${oauthUrl}) to authenticate yourself through Twitch.`));
    }
}
