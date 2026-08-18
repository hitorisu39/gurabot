import { Category, Command, Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { OsuService } from "@/modules/osu/Osu.service";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { ECommandCategory } from "@domain/core/Command";
import { OsekaiMedalsService } from "@/modules/osekai/OsekaiMedals.service";

@Category(ECommandCategory.Osu)
@Command({
    name: "avatar",
    description: "Sends player's osu! profile picture.",
    aliases: ["av"],
})
export class AvatarCommand extends AbstractOsuCommand {
    @Import() declare private readonly profileViewService: ProfileViewService;
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly osekaiMedalsService: OsekaiMedalsService;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const profile = await this.osuService.user(target.query, target.mode, target.server);
        const embed = this.profileViewService.createBaseEmbed(profile, Date.now(), false);

        embed.setThumbnail(null).setImage(ProfileFormatter.avatar(target.server, profile.id, Date.now()));
        await ctx.respond(embed);
    }
}
