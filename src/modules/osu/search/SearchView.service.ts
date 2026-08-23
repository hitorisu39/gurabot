import { Import } from "@/core/decorators";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { ActionRow } from "@/core/discord/ui/ActionRow";
import { Embed } from "@/core/discord/ui/Embed";
import { SelectMenu } from "@/core/discord/ui/SelectMenu";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { OsuService } from "@/modules/osu/Osu.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { TextFormatter } from "@domain/discord/formatters/Text.formatter";
import { Pagination } from "@domain/discord/utils/Pagination";
import { mapsetSearchPageSize } from "@domain/osu/configs/Beatmap.config";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { SearchViewDto } from "@domain/osu/views/Search.view";
import {
    AdapterProvider,
    Beatmap,
    BeatmapSearchExtra,
    BeatmapSearchGeneral,
    Beatmapset,
    GameMode,
} from "@generated/adapter/types";

interface IMapsetSummary {
    beatmaps: Array<Beatmap>;
    stars: string;
    bpm: string;
    difficulties: string;
    modes: Array<GameMode>;
}

export class SearchViewService extends AbstractViewService<SearchViewDto> {
    @Import() declare private readonly osuService: OsuService;

    protected readonly ttl = 180;

    public async prepare(data: SearchViewDto): Promise<void> {
        const requiredCount = Math.min(data.page * mapsetSearchPageSize, data.total);

        while (data.beatmapsets.length < requiredCount && data.cursorString) {
            const previousCursor = data.cursorString;
            const knownIDs = new Set(data.beatmapsets.map((mapset) => mapset.id));

            const result = await this.osuService.search(
                {
                    ...data.input,
                    cursorString: data.cursorString,
                },
                AdapterProvider.Bancho,
            );

            if (result.error) {
                throw new Exception(EApplicationError.INTERNAL_ERROR, result.error);
            }

            const fresh = result.beatmapsets.filter((mapset) => !knownIDs.has(mapset.id));

            data.beatmapsets.push(...fresh);
            data.cursorString = result.cursorString;
            data.total = result.total;

            if (!fresh.length && data.cursorString === previousCursor) {
                break;
            }
        }

        if (!data.cursorString && data.beatmapsets.length < data.total) {
            data.total = data.beatmapsets.length;
        }

        const totalPages = this.totalPages(data);
        if (data.page > totalPages) {
            data.page = totalPages;
        }
    }

    public build(sessionID: string, data: SearchViewDto): TMessagePayload {
        const totalPages = this.totalPages(data);
        const start = (data.page - 1) * mapsetSearchPageSize;

        const beatmapsets = data.beatmapsets.slice(start, start + mapsetSearchPageSize);
        const description = beatmapsets
            .map((mapset, index) => this.formatMapset(mapset, start + index + 1, data))
            .join("\n");

        const end = Math.min(start + beatmapsets.length, data.total);

        const embed = new Embed().setDescription(description || "No beatmapsets.").setFooter({
            text: `Showing ${start + 1}-${end} of ${data.total}`,
        });

        const components = this.components(sessionID, data, beatmapsets, totalPages);

        return {
            content: this.formatSearch(data),
            embeds: [embed],
            components,
        };
    }

    //#region Internal

    private components(
        sessionID: string,
        data: SearchViewDto,
        beatmapsets: Array<Beatmapset>,
        totalPages: number,
    ): Array<ActionRow> {
        const menu = new SelectMenu(`osu_search_select:${sessionID}`).setPlaceholder("Select a beatmapset...");

        for (const mapset of beatmapsets) {
            const summary = this.summarize(mapset, data);
            const description = [mapset.status, summary.stars, summary.difficulties].join(" • ");
            const emoji = summary.modes.length === 1 ? ProfileFormatter.modeEmote(summary.modes[0]!) : undefined;

            menu.addChoice(
                MapFormatter.mapsetHeader(mapset.artist, mapset.title, 100),
                mapset.id,
                description.slice(0, 100),
                emoji,
            );
        }

        const rows: Array<ActionRow> = [new ActionRow().add(menu)];

        if (totalPages > 1) {
            rows.push(Pagination.buildCursor("osu_search", sessionID, data.page, totalPages));
        }

        return rows;
    }

    private formatMapset(mapset: Beatmapset, index: number, data: SearchViewDto): string {
        const summary = this.summarize(mapset, data);
        const header = MapFormatter.mapsetHeader(mapset.artist, mapset.title, 35);
        const title = DiscordFormatter.link(header, MapFormatter.mapsetLink(mapset.id));

        const creator = DiscordFormatter.link(
            mapset.creator,
            ProfileFormatter.link(AdapterProvider.Bancho, mapset.userID),
        );

        const modes = summary.modes.map((mode) => ProfileFormatter.modeEmote(mode)).join("");

        return [
            `**${index}\\. ${title}** \`${summary.stars}\` \`${summary.difficulties}\``,
            `${mapset.status} by ${creator} • ${modes} • \`${summary.bpm}\``,
        ].join("\n");
    }

    private summarize(mapset: Beatmapset, data: SearchViewDto): IMapsetSummary {
        const allBeatmaps = mapset.beatmaps ?? [];
        const modeBeatmaps =
            data.input.mode !== undefined
                ? allBeatmaps.filter((beatmap) => beatmap.mode === data.input.mode)
                : allBeatmaps;

        const beatmaps = modeBeatmaps.length ? modeBeatmaps : allBeatmaps;

        if (!beatmaps.length) {
            return {
                beatmaps: [],
                stars: "?★",
                bpm: "? BPM",
                difficulties: "0 diffs",
                modes: [],
            };
        }

        const difficulties = beatmaps.map((beatmap) => beatmap.difficulty);

        const bpms = beatmaps.map((beatmap) => beatmap.bpm);

        const minStars = Math.min(...difficulties);
        const maxStars = Math.max(...difficulties);

        const minBpm = Math.min(...bpms);
        const maxBpm = Math.max(...bpms);

        const stars =
            minStars === maxStars
                ? MapFormatter.stars(minStars)
                : `${MapFormatter.stars(minStars)}–${MapFormatter.stars(maxStars)}`;

        const bpm =
            minBpm === maxBpm
                ? `${DiscordFormatter.fixed(minBpm)} BPM`
                : `${DiscordFormatter.fixed(minBpm)}–${DiscordFormatter.fixed(maxBpm)} BPM`;

        const modes = Array.from(new Set(beatmaps.map((beatmap) => beatmap.mode)));

        return {
            beatmaps,
            stars,
            bpm,
            difficulties: `${beatmaps.length} ` + (beatmaps.length === 1 ? "diff" : "diffs"),
            modes,
        };
    }

    private formatSearch(data: SearchViewDto): string {
        const { input } = data;
        const parts: Array<string> = [];

        if (input.query) {
            parts.push(TextFormatter.inlineCode(input.query));
        }

        if (input.mode !== undefined) {
            parts.push(TextFormatter.inlineCode(`mode=${input.mode.toLowerCase()}`));
        }

        if (input.status !== undefined) {
            parts.push(TextFormatter.inlineCode(`status=${input.status.toLowerCase()}`));
        }

        if (input.genre !== undefined) {
            parts.push(TextFormatter.inlineCode(`genre=${input.genre.toLowerCase()}`));
        }

        if (input.language !== undefined) {
            parts.push(TextFormatter.inlineCode(`language=${input.language.toLowerCase()}`));
        }

        if (input.nsfw !== undefined) {
            parts.push(TextFormatter.inlineCode(`nsfw=${input.nsfw}`));
        }

        if (input.extras?.includes(BeatmapSearchExtra.Video)) {
            parts.push(TextFormatter.inlineCode("video=true"));
        }

        if (input.extras?.includes(BeatmapSearchExtra.Storyboard)) {
            parts.push(TextFormatter.inlineCode("storyboard=true"));
        }

        if (input.general?.includes(BeatmapSearchGeneral.Converts)) {
            parts.push(TextFormatter.inlineCode("converts=true"));
        }

        if (input.general?.includes(BeatmapSearchGeneral.Spotlights)) {
            parts.push(TextFormatter.inlineCode("spotlights=true"));
        }

        if (input.general?.includes(BeatmapSearchGeneral.FeaturedArtists)) {
            parts.push(TextFormatter.inlineCode("featured_artists=true"));
        }

        if (input.sort) {
            parts.push(TextFormatter.inlineCode(`sort=${input.sort.field.toLowerCase()}`));

            if (input.sort.order) {
                parts.push(TextFormatter.inlineCode(`order=${input.sort.order.toLowerCase()}`));
            }
        }

        return `Query: ${parts.join(" • ")}`;
    }

    private totalPages(data: SearchViewDto): number {
        return Math.max(1, Math.ceil(data.total / mapsetSearchPageSize));
    }

    //#endregion
}
