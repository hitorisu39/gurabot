import { Import } from "@/core/decorators";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { OsekaiService } from "@/modules/osekai/Osekai.service";
import { Pagination } from "@domain/discord/utils/Pagination";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { OsekaiRankingViewDto } from "@domain/osekai/views/OsekaiRanking.view";
import {
    osekaiRankingApiPageSize,
    osekaiRankingMeta,
    osekaiRankingPageSize,
} from "@domain/osekai/configs/OsekaiRanking.config";
import { EOsekaiRankingEntryType, EOsekaiRankingValueFormat } from "@domain/osekai/enums/OsekaiRanking.enum";

export class OsekaiRankingViewService extends AbstractViewService<OsekaiRankingViewDto> {
    @Import() declare private readonly osekaiService: OsekaiService;

    protected readonly ttl: number = 180;

    public build(sessionID: string, data: OsekaiRankingViewDto): TMessagePayload {
        const meta = osekaiRankingMeta[data.ranking];

        const totalPages = Math.ceil(data.total / osekaiRankingPageSize) || 1;
        const components = totalPages > 1 ? [Pagination.build("osekai_ranking", sessionID, data.page, totalPages)] : [];

        const rankWidth = Math.max(...data.entries.map((entry) => `#${entry.rank}`.length));

        const items = data.entries.map((entry) => {
            const rank = `#${entry.rank}`.padEnd(rankWidth, " ");
            const flag = entry.countryCode ? `${DiscordFormatter.countryEmoji(entry.countryCode)}` : "";

            return {
                prefix: `\`${rank}\`${flag}`,
                label: entry.name,
                value: this.formatValue(entry.value, meta.valueFormat),
            };
        });

        const description = DiscordFormatter.formatInlineGrid(items, 2, 64, " ", 22, 12, "column");

        const embed = new Embed()
            .setTitle(`Osekai • ${meta.title}`)
            .setURL(meta.url)
            .setDescription(description)
            .setFooter({
                text: `${DiscordFormatter.quantity(
                    data.total,
                    meta.entryType === EOsekaiRankingEntryType.Medal ? "medal" : "player",
                )}`,
            });

        // const firstEntry = data.entries[0];
        // if (firstEntry) embed.setThumbnail(ProfileFormatter.avatar(AdapterProvider.Bancho, firstEntry.userID));

        return {
            embeds: [embed],
            components,
        };
    }

    public async prepare(data: OsekaiRankingViewDto): Promise<void> {
        const start = (data.page - 1) * osekaiRankingPageSize;
        const end =
            data.total > 0 ? Math.min(start + osekaiRankingPageSize, data.total) : start + osekaiRankingPageSize;

        const firstOffset = Math.floor(start / osekaiRankingApiPageSize) * osekaiRankingApiPageSize;
        const lastIndex = Math.max(start, end - 1);
        const lastOffset = Math.floor(lastIndex / osekaiRankingApiPageSize) * osekaiRankingApiPageSize;

        const offsets = firstOffset === lastOffset ? [firstOffset] : [firstOffset, lastOffset];
        const pages = await Promise.all(
            offsets.map((offset) => this.osekaiService.ranking(data.ranking, offset, data.country)),
        );

        const firstPage = pages[0];

        if (!firstPage) {
            data.total = 0;
            data.entries = [];
            return;
        }

        data.total = firstPage.total;

        const entries = pages.flatMap((page) => page.entries);
        const localStart = start - firstOffset;

        data.entries = entries.slice(localStart, localStart + osekaiRankingPageSize);
    }

    private formatValue(value: number, format: EOsekaiRankingValueFormat): string {
        switch (format) {
            case EOsekaiRankingValueFormat.PP:
                return `${DiscordFormatter.number(DiscordFormatter.fixed(value, 2))}pp`;
            case EOsekaiRankingValueFormat.Decimal:
                return DiscordFormatter.number(DiscordFormatter.fixed(value, 2));
            case EOsekaiRankingValueFormat.MedalRarity:
                return `${(value * 100).toFixed(6)}%`;
            case EOsekaiRankingValueFormat.PlaytimeTotal:
                return this.formatPlaytime(value);
            case EOsekaiRankingValueFormat.PlaytimeStandardDeviation:
                return `${DiscordFormatter.number(Math.round(value / 60))}h`;
            default:
                return DiscordFormatter.number(value);
        }
    }

    private formatPlaytime(minutes: number): string {
        const totalMinutes = Math.round(minutes);

        const days = Math.floor(totalMinutes / 1440);
        const hours = Math.floor((totalMinutes % 1440) / 60);
        const mins = totalMinutes % 60;

        if (days > 0) {
            return `${DiscordFormatter.number(days)}d ${hours}h`;
        }

        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }

        return `${mins}m`;
    }
}
