import { Import } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { CalculatorService } from "../calculator/Calculator.service";
import { MapViewDto } from "@domain/osu/views/Map.view";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { AdapterProvider, Beatmap, Beatmapset, GameMode } from "@generated/adapter/types";
import { Embed } from "@/core/discord/ui/Embed";
import { BeatmapAttributesCalculator } from "@domain/osu/utils/BeatmapAttributesCalculator";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { ScoreFormatter } from "@domain/osu/formatters/Score.formatter";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { AsciiTable } from "@domain/discord/utils/AsciiTable";
import { Pagination } from "@domain/discord/utils/Pagination";
import { osuMapsetDownloads } from "@domain/osu/configs/Osu.config";
import { IDifficultyCalculationResponse } from "@domain/core/Calculator";
import { GraphService } from "../Graph.service";
import { AttachmentBuilder } from "discord.js";

export class MapViewService extends AbstractService {
    @Import() declare private readonly graphService: GraphService;
    @Import() declare private readonly calculatorService: CalculatorService;

    private readonly ttl: number = 300;

    public async build(sessionID: string, data: MapViewDto, withGraph: boolean = false): Promise<TMessagePayload> {
        const beatmaps = [...(data.beatmapset.beatmaps || [])].sort((a, b) => a.difficulty - b.difficulty);
        const totalPages = beatmaps.length;

        let currentIndex = beatmaps.findIndex((b) => b.id === data.beatmapID);
        if (currentIndex === -1) currentIndex = 0;

        const currentMap = beatmaps[currentIndex]!;

        const difficulty = await this.calculatorService.difficultyWithStrains(
            currentMap.id,
            currentMap.mode,
            data.mods,
        );
        const embed = await this.createEmbed(data.beatmapset, currentMap, data, difficulty);
        embed.setImage("attachment://strains.png");

        const components = totalPages > 1 ? [Pagination.build("osu_map", sessionID, currentIndex + 1, totalPages)] : [];
        const payload: TMessagePayload = { embeds: [embed], components };

        if (withGraph && difficulty.strains) {
            const graph = await this.graphService.strains(
                difficulty.strains,
                currentMap.mode,
                data.beatmapset.covers.cover,
            );
            const attachment = new AttachmentBuilder(graph, { name: "strains.png" });
            payload.files = [attachment];
        }

        return payload;
    }

    private async createEmbed(
        mapset: Beatmapset,
        map: Beatmap,
        data: MapViewDto,
        difficulty: IDifficultyCalculationResponse<GameMode>,
    ): Promise<Embed> {
        const attributes = difficulty.attributes;
        const beatmapAttributes = difficulty.beatmap;

        const [pp100, pp99, pp97, pp95] = await Promise.all([
            this.calculatorService.performance(map.id, map.mode, { score: { accuracy: 1 } }, data.mods),
            this.calculatorService.performance(map.id, map.mode, { score: { accuracy: 0.99 } }, data.mods),
            this.calculatorService.performance(map.id, map.mode, { score: { accuracy: 0.97 } }, data.mods),
            this.calculatorService.performance(map.id, map.mode, { score: { accuracy: 0.95 } }, data.mods),
        ]);

        const liveBpm = BeatmapAttributesCalculator.bpm(map.bpm, beatmapAttributes.clockRate);
        const liveTotalLength = BeatmapAttributesCalculator.length(map.totalLength, beatmapAttributes.clockRate);
        const liveHitLength = BeatmapAttributesCalculator.length(map.hitLength, beatmapAttributes.clockRate);

        const tableGenerator = new AsciiTable({
            compact: true,
            padding: 1,
            borders: {
                left: false,
                right: false,
                top: false,
                bottom: false,
                vertical: "|",
                horizontal: "-",
                intersection: "+",
                headerSeparator: true,
            },
            columns: [
                { header: "Acc", accessor: "label", align: "center", headerAlign: "center" },
                { header: "95%", accessor: "pp95", align: "center", headerAlign: "center" },
                { header: "97%", accessor: "pp97", align: "center", headerAlign: "center" },
                { header: "99%", accessor: "pp99", align: "center", headerAlign: "center" },
                { header: "100%", accessor: "pp100", align: "center", headerAlign: "center" },
            ],
        });

        const tableString = tableGenerator.generate([
            {
                label: "PP",
                pp95: DiscordFormatter.fixed(pp95.attributes.total),
                pp97: DiscordFormatter.fixed(pp97.attributes.total),
                pp99: DiscordFormatter.fixed(pp99.attributes.total),
                pp100: DiscordFormatter.fixed(pp100.attributes.total),
            },
        ]);

        let fieldHeader = `:heart: ${mapset.favoriteCount} :play_pause: ${mapset.playcount}`;
        if (mapset.source) fieldHeader += ` | from ${mapset.source}`;

        const delimiter = DiscordFormatter.space(4);

        return new Embed()
            .setTitle(`${mapset.artist} - ${mapset.title}`)
            .setURL(MapFormatter.link(map.id))
            .setAuthor({
                name: `Mapset by ${mapset.creator}`,
                iconURL: ProfileFormatter.avatar(AdapterProvider.Bancho, mapset.userID, data.timestamp),
                url: ProfileFormatter.link(AdapterProvider.Bancho, mapset.userID),
            })
            .setDescription(
                `:musical_note: [Preview](${mapset.previewUrl}) ` +
                    `:frame_photo: [Background](${MapFormatter.background(mapset.id)}) ` +
                    `:clapper: [Map preview](${MapFormatter.previewGameplay(map.id)}) ([mirror](${MapFormatter.previewGameplayMirror(map.id)}))`,
            )
            .addFields(
                {
                    inline: true,
                    name: `${MapFormatter.difficultyEmote(map.mode, attributes.starRating)} __${map.version} [${MapFormatter.stars(attributes.starRating)}]__ ${ScoreFormatter.mods(data.mods)}`,
                    value:
                        `Length: \`${MapFormatter.length(liveTotalLength)}\` (\`${MapFormatter.length(liveHitLength)}\`)${delimiter}Combo: \`${attributes.maxCombo}x\`\n` +
                        `Circles: \`${map.countCircles}\`${delimiter}Sliders: \`${map.countSliders}\`${delimiter}Spinners: \`${map.countSpinners}\`\n` +
                        `CS\`${DiscordFormatter.fixed(beatmapAttributes.cs)}\` AR\`${DiscordFormatter.fixed(beatmapAttributes.ar)}\` OD\`${DiscordFormatter.fixed(beatmapAttributes.od)}\` HP\`${DiscordFormatter.fixed(beatmapAttributes.hp)}\` BPM\`${DiscordFormatter.fixed(liveBpm)}\``,
                },
                {
                    inline: true,
                    name: "Downloads",
                    value: osuMapsetDownloads.map((d) => `[${d.name}](${d.base}/${mapset.id})`).join("\n"),
                },
                {
                    name: fieldHeader,
                    value: "```" + tableString + "```",
                },
            )
            .setFooter({
                text: `${map.status}`,
            })
            .setTimestamp(mapset.rankedDate ?? map.lastUpdated);
    }

    public getTtl(): number {
        return this.ttl;
    }
}
