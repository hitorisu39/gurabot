import { Import } from "@/core/decorators";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { Pagination } from "@domain/discord/utils/Pagination";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { MedalRecentViewDto } from "@domain/osu/views/MedalRecent.view";
import { MedalFormatter } from "@domain/osu/formatters/Medal.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";

export class MedalRecentViewService extends AbstractViewService<MedalRecentViewDto> {
    @Import() declare private readonly profileViewService: ProfileViewService;

    protected readonly ttl: number = 180;

    public build(sessionID: string, data: MedalRecentViewDto): TMessagePayload {
        const totalPages = data.medals.length || 1;
        const entry = data.medals[data.page - 1];
        const components =
            totalPages > 1 ? [Pagination.build("osu_medal_recent", sessionID, data.page, totalPages)] : [];

        const embed = this.profileViewService.createBaseEmbed(data.profile, null, false);

        if (!entry) {
            return {
                content: `Most recent \`${data.profile.username}\`'s medals:`,
                embeds: [embed.setDescription("No medals.")],
                components,
            };
        }

        const medal = entry.medal;

        embed
            .setTitle(medal.name)
            .setURL(medal.url())
            .setDescription(
                [MedalFormatter.requirements(medal), MedalFormatter.text(medal.description)].filter(Boolean).join("\n"),
            )
            .addFields(
                {
                    name: "Solution",
                    value: MedalFormatter.solutionField(medal, data.spoil),
                },
                {
                    name: "Rarity",
                    value: MedalFormatter.rarity(medal),
                    inline: true,
                },
                {
                    name: "Availability",
                    value: MedalFormatter.availability(medal),
                    inline: true,
                },
                {
                    name: "First achieved",
                    value: MedalFormatter.firstAchieved(medal),
                    inline: true,
                },
                {
                    name: "\u200b",
                    value: `-# Achieved ${DateFormatter.discord(entry.achievedAt, "R")}`,
                },
            );

        const mode = MedalFormatter.gamemode(medal.gamemode);

        embed.setFooter({
            text: MedalFormatter.footer(medal),
            iconURL: mode ? ProfileFormatter.modeIcon(mode) : undefined,
        });

        return {
            content: `Most recent \`${data.profile.username}\`'s medals:`,
            embeds: [embed],
            components,
        };
    }
}
