import { Import } from "@/core/decorators";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { Pagination } from "@domain/discord/utils/Pagination";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { MedalFormatter } from "@domain/osu/formatters/Medal.formatter";
import { MedalListEntryDto, MedalListViewDto } from "@domain/osu/views/MedalList.view";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";

export class MedalListViewService extends AbstractViewService<MedalListViewDto> {
    @Import() declare private readonly profileViewService: ProfileViewService;

    protected readonly ttl: number = 180;
    private readonly pageSize: number = 10;

    public build(sessionID: string, data: MedalListViewDto): TMessagePayload {
        const totalPages = Math.ceil(data.medals.length / this.pageSize) || 1;
        const start = (data.page - 1) * this.pageSize;
        const medals = data.medals.slice(start, start + this.pageSize);

        const embed = this.profileViewService.createBaseEmbed(data.profile, null, false, false);

        embed
            .setDescription(medals.length ? this.medals(medals, start) : "No achieved medals matching these filters.")
            .setFooter({
                text: this.footer(data),
            });

        const components = totalPages > 1 ? [Pagination.build("osu_medal_list", sessionID, data.page, totalPages)] : [];

        return {
            content: this.content(data),
            embeds: [embed],
            components,
        };
    }

    public getPageSize(): number {
        return this.pageSize;
    }

    private medals(medals: ReadonlyArray<MedalListEntryDto>, offset: number): string {
        const lines: Array<string> = [];
        let currentGroup: string | null = null;

        medals.forEach((entry, index) => {
            const medal = entry.medal;
            const group = medal.grouping || "Other";

            if (group !== currentGroup) {
                if (lines.length) {
                    lines.push("");
                }

                lines.push(`**${group}**`);
                currentGroup = group;
            }

            const number = offset + index + 1;
            const medalLink = DiscordFormatter.link(medal.name, medal.url());

            lines.push(
                `\`${number}.\` ${medalLink} — **${MedalFormatter.frequency(medal)}** on ${DateFormatter.shortDate(entry.achievedAt)}`,
            );
        });

        return lines.join("\n");
    }

    private content(data: MedalListViewDto): string {
        const filters: Array<string> = [];

        if (data.group) {
            filters.push(data.group);
        }

        if (data.mode !== null) {
            filters.push(ProfileFormatter.mode(data.mode, true));
        }

        if (!filters.length) {
            return `\`${data.profile.username}\`'s achieved medals:`;
        }

        return `\`${data.profile.username}\`'s achieved medals • ${filters.join(" • ")}:`;
    }

    private footer(data: MedalListViewDto): string {
        const achieved = data.medals.length;
        const missing = Math.max(0, data.totalMedals - achieved);
        return [`${achieved} achieved`, `${missing} missing`, `${data.totalMedals} total`].join(" • ");
    }
}
