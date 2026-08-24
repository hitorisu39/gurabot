import { Import } from "@/core/decorators";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { OsuService } from "@/modules/osu/Osu.service";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { Pagination } from "@domain/discord/utils/Pagination";
import { snipePlayerListApiPageSize, snipePlayerListPageSize } from "@domain/snipe/configs/Snipe.config";
import { SnipePlayerListViewDto } from "@domain/snipe/views/SnipePlayerList.view";
import { SnipeScoreDto } from "@domain/snipe/SnipeScore.dto";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { ESortOrder } from "@domain/osu/enums/Score.enum";
import { SnipeService } from "./Snipe.service";
import { ProfileViewService } from "../osu/profile/ProfileView.service";
import { Beatmap } from "@generated/adapter/types";
import { discordMaxVisualLineLength } from "@domain/discord/configs/Discord.config";
import { ScoreFormatter } from "@domain/osu/formatters/Score.formatter";
import { scoreStatsCompactDelimiter } from "@domain/osu/configs/Score.config";

export class SnipePlayerListViewService extends AbstractViewService<SnipePlayerListViewDto> {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly snipeService: SnipeService;
    @Import() declare private readonly profileViewService: ProfileViewService;

    protected readonly ttl = 180;

    public async build(sessionID: string, data: SnipePlayerListViewDto): Promise<TMessagePayload> {
        const totalPages = this.totalPages(data);

        const scores = this.pageScores(data);
        const maps = await this.osuService.beatmaps(scores.map((score) => score.beatmap.mapID));
        const mapsByID = new Map(maps.map((map) => [map.id, map]));
        const offset = (data.page - 1) * snipePlayerListPageSize;

        const description = scores
            .map((score, index) => this.formatScore(score, mapsByID.get(score.beatmap.mapID), offset + index + 1))
            .join("\n");

        const embed = this.profileViewService
            .createBaseEmbed(data.profile, data.timestamp, false)
            .setDescription(description);

        return {
            content: this.formatContent(data),
            embeds: [embed],
            components: totalPages > 1 ? [Pagination.build("snipe_player_list", sessionID, data.page, totalPages)] : [],
        };
    }

    public async prepare(data: SnipePlayerListViewDto): Promise<void> {
        const requiredApiPage =
            Math.floor(((data.page - 1) * snipePlayerListPageSize) / snipePlayerListApiPageSize) + 1;

        if (requiredApiPage === data.apiPage) {
            return;
        }

        const result = await this.snipeService.playerScores({
            userID: data.profile.id,
            country: data.profile.countryCode,
            page: requiredApiPage,
            sort: data.sort,
            order: data.order,
            mods: data.mods,
        });

        data.apiPage = requiredApiPage;
        data.scores = result.scores;
    }

    private pageScores(data: SnipePlayerListViewDto): Array<SnipeScoreDto> {
        const globalOffset = (data.page - 1) * snipePlayerListPageSize;
        const apiOffset = (data.apiPage - 1) * snipePlayerListApiPageSize;
        const localOffset = globalOffset - apiOffset;

        return data.scores.slice(localOffset, localOffset + snipePlayerListPageSize);
    }

    private totalPages(data: SnipePlayerListViewDto): number {
        return Math.max(1, Math.ceil(data.total / snipePlayerListPageSize));
    }

    private formatScore(score: SnipeScoreDto, map: Beatmap | undefined, index: number): string {
        const mapID = score.beatmap.mapID;
        const mods = score.mods && score.mods !== "NM" ? ` +${score.mods}` : "";
        const stars = `${DiscordFormatter.fixed(score.stars, 2)}★`;

        const prefixLength = `${index}\\. `.length;
        const suffixLength = mods ? ` ${mods}`.length : 0;
        const headerLimit = Math.max(20, discordMaxVisualLineLength - prefixLength - suffixLength);

        const header = map?.beatmapset
            ? MapFormatter.header(map.beatmapset.artist, map.beatmapset.title, map.version, headerLimit)
            : `Beatmap #${mapID}`;
        const firstLine = `**${index}\\. [${header}](${MapFormatter.link(mapID)})${mods}**`;

        const pp = score.pp === null ? "-pp" : `${DiscordFormatter.fixed(score.pp, 2)}pp`;
        const misses = ScoreFormatter.miss(score.misses ?? 0, true);

        const details = [`**${pp}**`, `${DiscordFormatter.fixed(score.accuracy, 2)}%`, stars, misses];

        if (score.date) {
            details.push(DateFormatter.discord(score.date, "R"));
        }

        return `${firstLine}\n${details.join(scoreStatsCompactDelimiter)}`;
    }

    private formatContent(data: SnipePlayerListViewDto): string {
        const filtered = Boolean(data.mods);
        const header =
            `\`${data.profile.username}\` has ${DiscordFormatter.number(data.total)} ` +
            `national #1${data.total === 1 ? "" : "s"}` +
            `${filtered ? " with these filters" : ""}:`;

        const order = `Order: \`${data.sort} (${this.formatOrder(data.order)})\``;

        if (!data.mods) {
            return `${order}\n${header}`;
        }

        const mods = data.mods === "nomod" ? "NM" : data.mods;
        return `${order} ~ Mods: \`${mods}\`\n${header}`;
    }

    private formatOrder(order: ESortOrder): string {
        return order === ESortOrder.Ascending ? "Asc" : "Desc";
    }
}
