import { Import } from "@/core/decorators";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { AbstractService } from "@/core/framework/AbstractService";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { OsuStatsCountViewDto } from "@domain/osustats/views/OsuStatsCount.view";
import { AdapterProvider } from "@generated/adapter/types";

export class OsuStatsCountViewService extends AbstractService {
    @Import() declare private readonly profileViewService: ProfileViewService;

    public build(data: OsuStatsCountViewDto): TMessagePayload {
        const embed = this.profileViewService.createBaseEmbed(data.profile, null, false);
        const items = data.counts.entries.map((entry) => ({
            label: `Top ${entry.rank}`,
            value: DiscordFormatter.number(entry.count),
        }));

        const grid = DiscordFormatter.formatInlineGrid(items, 2, 64, " ", 12, 12, "column");

        const username = DiscordFormatter.link(
            data.profile.username,
            ProfileFormatter.link(AdapterProvider.Bancho, data.profile.id),
            null,
            true,
        );

        embed.setDescription(grid).setFooter({
            text: "Data provided by osu!stats",
            iconURL: ProfileFormatter.modeIcon(data.profile.mode),
        });

        return {
            content: `${username} on global leaderboards:`,
            embeds: [embed],
        };
    }
}
