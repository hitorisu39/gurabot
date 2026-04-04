import { Import, IsEnum, IsString, Option, Subcommand } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { UserService } from "@/modules/user/User.service";
import { AdapterProvider } from "@generated/adapter/types";
import { OsuService } from "@/modules/osu/Osu.service";
import { CommandOption } from "@domain/core/Command";
import { randomBytes } from "crypto";
import { osuBaseUrl } from "@domain/osu/configs/Osu.config";

@Subcommand({
    root: "link",
    name: "osu",
    description: "Link your osu! profile to your Discord.",
    ephemeral: true,
})
export class LinkOsuSubcommand extends AbstractCommand {
    @Import() declare private readonly userService: UserService;
    @Import() declare private readonly osuService: OsuService;

    @Option("name", "Your osu! username")
    @IsString(2, 20)
    declare private readonly name: CommandOption<string>;

    @Option("server", "Specify a server to link to")
    @IsEnum(AdapterProvider)
    declare private readonly server: CommandOption<AdapterProvider>;

    public async execute(ctx: CommandContext): Promise<void> {
        const provider = this.server.unwrapOr(AdapterProvider.Bancho);
        const state = randomBytes(16).toString("hex");
        await this.cache.set("auth_osu_state", { discord: ctx.author.id, provider: provider }, 300, state);

        const clientID = this.config.adapter.osu.client_id;
        const redirectUri = this.config.adapter.osu.redirect_uri;
        const oauthUrl = `${osuBaseUrl}/oauth/authorize?client_id=${clientID}&redirect_uri=${redirectUri}&response_type=code&scope=public&state=${state}`;

        await ctx.respond(Embed.general(`Please [click here](${oauthUrl}) to authenticate yourself through osu!`));
        return;

        // const profile = await this.osuService.user(this.name.unwrap(), GameMode.Standard, provider);
        // if (!profile)
        //     throw new Exception(
        //         EApplicationError.INPUT_ERROR,
        //         `${ProviderMeta[provider].name} profile with that name was not found.`,
        //     );

        // await this.userService.link(ctx.author.id, profile.id, provider);
        // await ctx.respond(Embed.success(`\`${profile.username}\` was successfully linked to your Discord.`));
    }
}
