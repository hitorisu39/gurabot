import { Import } from "@/core/decorators";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { Pagination } from "@domain/discord/utils/Pagination";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { MedalFormatter } from "@domain/osu/formatters/Medal.formatter";
import { MedalMissingViewDto } from "@domain/osu/views/MedalMissing.view";
import { OsekaiMedalDto } from "@domain/osekai/OsekaiMedal.dto";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";

export class MedalMissingViewService extends AbstractViewService<MedalMissingViewDto> {
    @Import() declare private readonly profileViewService: ProfileViewService;

    protected readonly ttl: number = 180;
    private readonly pageSize: number = 10;

    public build(sessionID: string, data: MedalMissingViewDto): TMessagePayload {
        const totalPages = Math.ceil(data.medals.length / this.pageSize) || 1;
        const start = (data.page - 1) * this.pageSize;
        const medals = data.medals.slice(start, start + this.pageSize);

        const embed = this.profileViewService.createBaseEmbed(data.profile, null, false, false);

        embed
            .setDescription(medals.length ? this.medals(medals, start) : "No missing medals matching these filters. 🎉")
            .setFooter({
                text: this.footer(data),
            });

        const components =
            totalPages > 1 ? [Pagination.build("osu_medal_missing", sessionID, data.page, totalPages)] : [];

        return {
            content: this.content(data),
            embeds: [embed],
            components,
        };
    }

    private content(data: MedalMissingViewDto): string {
        const filters: Array<string> = [];

        if (data.group) {
            filters.push(data.group);
        }

        if (data.mode !== null) {
            filters.push(ProfileFormatter.mode(data.mode, true));
        }

        if (!filters.length) {
            return `Missing \`${data.profile.username}\`'s medals:`;
        }

        return `Missing \`${data.profile.username}\`'s medals • ${filters.join(" • ")}:`;
    }

    public getPageSize(): number {
        return this.pageSize;
    }

    private medals(medals: ReadonlyArray<OsekaiMedalDto>, offset: number): string {
        const lines: Array<string> = [];

        let currentGroup: string | null = null;

        medals.forEach((medal, index) => {
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
            lines.push(`\`${number}.\` ${medalLink} — **${MedalFormatter.frequency(medal)}**`);
        });

        return lines.join("\n");
    }

    private footer(data: MedalMissingViewDto): string {
        const missing = data.medals.length;
        const achieved = Math.max(0, data.totalMedals - missing);
        return [`${missing} missing`, `${achieved} achieved`, `${data.totalMedals} total`].join(" • ");
    }
}
