import { TMessagePayload } from "@/core/discord/context/MessagePayload";
import { Embed } from "@/core/discord/ui/Embed";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { EModMatchType, ICommandDateRange, ICommandRange } from "@domain/core/Command";
import { discordMaxVisualLineLength } from "@domain/discord/configs/Discord.config";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { Pagination } from "@domain/discord/utils/Pagination";
import { FarmMapsMapDto } from "@domain/farm/FarmMaps.dto";
import { EFarmSort, EFarmSortOrder, IFarmMapQuery } from "@domain/farm/Farm.types";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { ScoreFormatter } from "@domain/osu/formatters/Score.formatter";
import { FarmMapsViewDto } from "@domain/farm/views/FarmMaps.view";
import { farmMapsPageSize } from "@domain/farm/configs/Farm.config";
import { ModUtils } from "@generated/adapter/mods";

export class FarmMapsViewService extends AbstractViewService<FarmMapsViewDto> {
    protected readonly ttl = 180;

    public build(sessionID: string, data: FarmMapsViewDto): TMessagePayload {
        const startIndex = (data.page - 1) * farmMapsPageSize;
        const description = data.maps.map((map, index) => this.formatMap(map, startIndex + index + 1)).join("\n");

        const embed = new Embed().setDescription(description || "No farm maps.").setFooter({
            text: `${ProfileFormatter.mode(data.mode)} • data by osu-pps.com`,
            iconURL: ProfileFormatter.modeIcon(data.mode),
        });

        const components =
            data.lastPage === 1 ? [] : [Pagination.buildLazy("farm_maps", sessionID, data.page, data.lastPage)];

        return {
            content: this.formatContext(data.query),
            embeds: [embed],
            components,
        };
    }

    private formatMap(map: FarmMapsMapDto, index: number): string {
        const stars = MapFormatter.stars(map.stars);
        const parsedMods = ModUtils.fromBits(map.mods);
        const mods = ScoreFormatter.mods(parsedMods);

        const prefixLength = `${index}. `.length;
        const suffixLength = mods ? `[${stars}] ${mods}`.length : `[${stars}]`.length;
        const headerLimit = Math.max(20, discordMaxVisualLineLength - prefixLength - suffixLength);
        const header = MapFormatter.header(map.artist, map.title, map.version, headerLimit);
        const modsDisplay = mods ? ` ${mods}` : "";

        const firstLine = `**${index}\\. [${header}](${MapFormatter.link(map.beatmapID)})${modsDisplay}** [${stars}]`;

        const attributes = [
            `CS: ${DiscordFormatter.fixed(map.cs)}`,
            `AR: ${DiscordFormatter.fixed(map.ar)}`,
            `OD: ${DiscordFormatter.fixed(map.od)}`,
            `HP: ${DiscordFormatter.fixed(map.hp)}`,
        ].join(" ");

        const secondLine = [
            MapFormatter.length(map.length),
            `\`${attributes}\``,
            `♫ ${DiscordFormatter.fixed(map.bpm)}`,
        ].join(" • ");

        const averagePP =
            map.pp !== undefined && map.pp !== null
                ? `≈${DiscordFormatter.fixed(map.pp)}pp avg. top play`
                : "?pp avg. top play";

        const thirdLine = `\`${averagePP}\` • \`farmability: ${DiscordFormatter.fixed(map.farmability)}\``;
        return `${firstLine}\n${secondLine}\n${thirdLine}`;
    }

    private formatContext(query: IFarmMapQuery): string {
        const order = this.formatOrder(query);
        const filters = this.formatFilters(query);
        return `Order: \`${order}\`\nFilters: \`${filters || "None"}\``;
    }

    private formatOrder(query: IFarmMapQuery): string {
        const sort = query.sort ?? EFarmSort.Farmability;
        if (sort === EFarmSort.Random) {
            return "Random";
        }

        const direction = (query.order ?? EFarmSortOrder.Descending) === EFarmSortOrder.Ascending ? "Asc" : "Desc";

        return `${sort} (${direction})`;
    }

    private formatFilters(query: IFarmMapQuery): string {
        const parts: Array<string> = [];

        this.pushRange(parts, "pp", query.pp);
        this.pushRange(parts, "length", query.length);
        this.pushRange(parts, "bpm", query.bpm);
        this.pushRange(parts, "stars", query.stars);
        this.pushRange(parts, "ar", query.ar);
        this.pushRange(parts, "cs", query.cs);
        this.pushRange(parts, "od", query.od);
        this.pushRange(parts, "hp", query.hp);

        if (query.ranked) {
            this.pushDateRange(parts, "ranked", query.ranked);
        }

        if (query.mods) {
            const plain = ModUtils.toPlain(ModUtils.fromBits(query.mods.bits)).join("") || "NM";
            const prefix = query.mods.type === EModMatchType.Exclude ? "-" : "+";
            const suffix = query.mods.type === EModMatchType.Match ? "!" : "";
            parts.push(`${prefix}${plain}${suffix}`);
        }

        return parts.join(", ");
    }

    private pushRange(parts: Array<string>, name: string, range?: ICommandRange | null): void {
        if (!range) {
            return;
        }

        if (range.exact !== undefined) {
            parts.push(`${name}=${DiscordFormatter.fixed(range.exact)}`);
            return;
        }

        const min = Number.isFinite(range.min) ? DiscordFormatter.fixed(range.min) : null;
        const max = Number.isFinite(range.max) ? DiscordFormatter.fixed(range.max) : null;

        if (min !== null && max !== null) {
            parts.push(`${name}=${min}-${max}`);
        } else if (min !== null) {
            parts.push(`${name}${range.minInclusive ? ">=" : ">"}${min}`);
        } else if (max !== null) {
            parts.push(`${name}${range.maxInclusive ? "<=" : "<"}${max}`);
        }
    }

    private pushDateRange(parts: Array<string>, name: string, range: ICommandDateRange): void {
        if (range.exact) {
            parts.push(`${name}=${this.date(range.exact)}`);
            return;
        }

        const min = range.min ? this.date(range.min) : null;
        const max = range.max ? this.date(range.max) : null;

        if (min && max) {
            parts.push(`${name}=${min}..${max}`);
        } else if (min) {
            parts.push(`${name}${range.minInclusive ? ">=" : ">"}${min}`);
        } else if (max) {
            parts.push(`${name}${range.maxInclusive ? "<=" : "<"}${max}`);
        }
    }

    private date(value: Date): string {
        return new Date(value).toISOString().slice(0, 10);
    }
}
