import { Import } from "@/core/decorators";
import { Embed } from "@/core/discord/ui/Embed";
import { AbstractService } from "@/core/framework/AbstractService";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { BwsViewDto } from "@domain/osu/Bws.dto";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";

export class BwsViewService extends AbstractService {
    @Import() declare private readonly profileViewService: ProfileViewService;

    public build(data: BwsViewDto): Embed {
        const embed = this.profileViewService.createBaseEmbed(data.profile, null, false).addFields(
            {
                name: "BWS Rank",
                value: ProfileFormatter.rank(data.bws),
                inline: true,
            },
            {
                name: data.custom ? "Badges" : "Tournament Badges",
                value: DiscordFormatter.number(data.badgeCount),
                inline: true,
            },
            {
                name: "Next Badge",
                value: ProfileFormatter.rank(data.nextBws),
                inline: true,
            },
        );

        if (!data.custom) embed.setFooter({ text: "Tournament badge detection may be inaccurate." });

        return embed;
    }
}
