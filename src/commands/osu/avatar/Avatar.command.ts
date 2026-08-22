import { Category, Command, Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { OsuService } from "@/modules/osu/Osu.service";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { ECommandCategory } from "@domain/core/Command";

@Category(ECommandCategory.Osu)
@Command({
    name: "avatar",
    description: "Sends player's osu! profile picture.",
    aliases: ["av"],
})
export class AvatarCommand extends AbstractOsuCommand {
    @Import() declare private readonly profileViewService: ProfileViewService;
    @Import() declare private readonly osuService: OsuService;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const profile = await this.osuService.user(target.query, target.mode, target.server);
        const embed = this.profileViewService.createBaseEmbed(profile, Date.now(), false);

        console.log(profile.matchmakingStats);

        embed.setThumbnail(null).setImage(ProfileFormatter.avatar(target.server, profile.id, Date.now()));
        await ctx.respond(embed);
    }
}
