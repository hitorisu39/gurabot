import { Import } from "@/core/decorators";
import { TMessagePayload } from "@/core/discord/context/MessagePayload";
import { ActionRow } from "@/core/discord/ui/ActionRow";
import { SelectMenu } from "@/core/discord/ui/SelectMenu";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { FarmRecommendationDto } from "@domain/farm/FarmRecommend.dto";
import { EFarmSort, IFarmMapQuery } from "@domain/farm/Farm.types";
import { EModMatchType, ICommandDateRange, ICommandRange } from "@domain/core/Command";
import { discordMaxVisualLineLength } from "@domain/discord/configs/Discord.config";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { ScoreFormatter } from "@domain/osu/formatters/Score.formatter";
import { ButtonStyle } from "discord.js";
import { FarmRecommendViewDto } from "@domain/farm/views/FarmRecommend.view";
import { ModUtils } from "@generated/adapter/mods";
import { isValidNumber } from "@domain/utils/utils";

export class FarmRecommendViewService extends AbstractViewService<FarmRecommendViewDto> {
    @Import() declare private readonly profileViewService: ProfileViewService;

    protected readonly ttl = 180;

    public build(sessionID: string, data: FarmRecommendViewDto): TMessagePayload {
        const embed = this.profileViewService.createBaseEmbed(data.profile, data.timestamp, false);
        const description = data.recommendations
            .map((map, index) => this.formatRecommendation(map, index + 1))
            .join("\n");

        embed.setDescription(description || "No recommendations.").setFooter({
            text: "Based on top plays • data by osu-pps.com",
            iconURL: ProfileFormatter.modeIcon(data.profile.mode),
        });

        const components: Array<ActionRow> = [];

        if (data.recommendations.length) {
            const menu = new SelectMenu(`farm_recommend_replace:${sessionID}`)
                .setPlaceholder("Replace recommendations...")
                .setMinValues(1)
                .setMaxValues(data.recommendations.length);

            for (const [index, map] of data.recommendations.entries()) {
                const mods = this.mods(map.mods);
                menu.addChoice(
                    `${index + 1}. ${map.artist} - ${map.title}`.slice(0, 100),
                    index,
                    `[${map.version}] ${mods} • ${MapFormatter.stars(map.stars)}`.slice(0, 100),
                );
            }

            components.push(new ActionRow().add(menu));
            components.push(
                new ActionRow().addButton("Reroll all", `farm_recommend_reroll:${sessionID}`, ButtonStyle.Secondary, {
                    emoji: "🎲",
                }),
            );
        }

        return {
            content: this.formatContext(data.query),
            embeds: [embed],
            components,
        };
    }

    private formatRecommendation(map: FarmRecommendationDto, index: number): string {
        const stars = MapFormatter.stars(map.stars);
        const mods = ScoreFormatter.mods(ModUtils.fromBits(map.mods));
        const prefixLength = `${index}. `.length;
        const suffixLength = mods ? `[${stars}] ${mods}`.length : `[${stars}]`.length;
        const headerLimit = Math.max(20, discordMaxVisualLineLength - prefixLength - suffixLength);
        const header = MapFormatter.header(map.artist, map.title, map.version, headerLimit);
        const modsDisplay = mods ? ` ${mods}` : "";

        const top = `**${index}\\. [${header}](${MapFormatter.link(map.beatmapID)})${modsDisplay}** [${stars}]`;

        const attrs = [
            `CS: ${DiscordFormatter.fixed(map.cs)}`,
            `AR: ${DiscordFormatter.fixed(map.ar)}`,
            `OD: ${DiscordFormatter.fixed(map.od)}`,
            `HP: ${DiscordFormatter.fixed(map.hp)}`,
        ].join(" ");

        const details = [MapFormatter.length(map.length), `\`${attrs}\``, `♫ ${DiscordFormatter.fixed(map.bpm)}`].join(
            " • ",
        );

        const pp =
            map.pp !== undefined && map.pp !== null
                ? `≈${DiscordFormatter.fixed(map.pp)}pp avg. top play`
                : "?pp avg. top play";

        const farm = `farmability: ${DiscordFormatter.fixed(map.farmability)}`;

        return `${top}\n\`${pp}\` • \`${farm}\`\n${details}`;
    }

    private formatContext(query: IFarmMapQuery): string {
        const order = query.sort === EFarmSort.Farmability ? "Farmability (Desc)" : "Random";
        const filters = this.formatFilters(query);

        return `Order: \`${order}\`\nFilters: \`${filters}\``;
    }

    private formatFilters(query: IFarmMapQuery): string {
        const parts: Array<string> = [];

        this.pushRange(parts, "pp", query.pp);
        this.pushRange(parts, "length", query.length);
        this.pushRange(parts, "bpm", query.bpm);
        if (query.stars) this.pushRange(parts, "stars", query.stars);
        this.pushRange(parts, "ar", query.ar);
        this.pushRange(parts, "cs", query.cs);
        this.pushRange(parts, "od", query.od);
        this.pushRange(parts, "hp", query.hp);

        if (query.ranked) {
            parts.push(`ranked=${this.dateRange(query.ranked)}`);
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

        const min = isValidNumber(range.min) ? DiscordFormatter.fixed(range.min) : null;
        const max = isValidNumber(range.max) ? DiscordFormatter.fixed(range.max) : null;

        if (min !== null && max !== null) {
            parts.push(`${name}=${min}-${max}`);
        } else if (min !== null) {
            parts.push(`${name}${range.minInclusive ? ">=" : ">"}${min}`);
        } else if (max !== null) {
            parts.push(`${name}${range.maxInclusive ? "<=" : "<"}${max}`);
        }
    }

    private dateRange(range: ICommandDateRange): string {
        if (range.exact) return this.date(range.exact);

        const min = range.min ? this.date(range.min) : null;
        const max = range.max ? this.date(range.max) : null;

        if (min && max) return `${min}..${max}`;
        if (min) return `${range.minInclusive ? ">=" : ">"}${min}`;
        if (max) return `${range.maxInclusive ? "<=" : "<"}${max}`;

        return "any";
    }

    private date(value: Date): string {
        return new Date(value).toISOString().slice(0, 10);
    }

    private mods(bits: number): string {
        const mods = ModUtils.fromBits(bits);
        return ScoreFormatter.mods(mods, true, true);
    }
}
