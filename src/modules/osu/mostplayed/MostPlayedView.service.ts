import { Import } from "@/core/decorators";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { TextFormatter } from "@domain/discord/formatters/Text.formatter";
import { Pagination } from "@domain/discord/utils/Pagination";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { MostPlayedViewDto } from "@domain/osu/views/MostPlayed.view";
import { BeatmapPlaycount } from "@generated/adapter/types";
import { ProfileViewService } from "../profile/ProfileView.service";
import { discordMaxVisualLineLength } from "@domain/discord/configs/Discord.config";

export class MostPlayedViewService extends AbstractViewService<MostPlayedViewDto> {
    @Import() declare private readonly profileViewService: ProfileViewService;

    protected readonly ttl = 180;
    private readonly pageSize = 10;

    public build(sessionID: string, data: MostPlayedViewDto): TMessagePayload {
        const totalPages = Math.ceil(data.beatmaps.length / this.pageSize) || 1;
        const page = Math.min(Math.max(data.page, 1), totalPages);
        const start = (page - 1) * this.pageSize;
        const entries = data.beatmaps.slice(start, start + this.pageSize);

        const components = totalPages > 1 ? [Pagination.build("osu_most_played", sessionID, page, totalPages)] : [];

        return {
            content: `${TextFormatter.possessive(data.profile.username, true)} most played beatmaps:`,
            embeds: [this.embed(data, entries)],
            components,
        };
    }

    public getPageSize(): number {
        return this.pageSize;
    }

    private embed(data: MostPlayedViewDto, entries: ReadonlyArray<BeatmapPlaycount>): Embed {
        const description = entries.length
            ? entries.map((entry) => this.entry(entry)).join("\n")
            : "*No most played beatmaps found.*";

        return this.profileViewService
            .createBaseEmbed(data.profile, data.timestamp, false, false)
            .setDescription(description);
    }

    private entry(entry: BeatmapPlaycount): string {
        if (!entry.beatmap || !entry.beatmapset) {
            return "";
        }

        const prefix = `**[${DiscordFormatter.number(entry.count)}]** `;
        const stars = `[${MapFormatter.stars(entry.beatmap.difficulty)}]`;
        const suffix = ` ${stars}`;

        const headerLimit = Math.max(20, discordMaxVisualLineLength - prefix.length - suffix.length);
        const header = MapFormatter.header(
            entry.beatmapset.artist,
            entry.beatmapset.title,
            entry.beatmap.version,
            headerLimit,
        );

        const linkedHeader = DiscordFormatter.link(header, MapFormatter.link(entry.beatmapID));
        return `${prefix}${linkedHeader}${suffix}`;
    }
}
