import { CommandContext } from "@/core/discord/context/CommandContext";
import {
    Aliases,
    Category,
    Command,
    Examples,
    Help,
    Import,
    Inject,
    IsMods,
    IsString,
    Option,
} from "@/core/decorators";
import { OsuService } from "@/modules/osu/Osu.service";
import { CommandOption, ECommandCategory, ICommandMods } from "@domain/core/Command";
import { CalculatorService } from "@/modules/osu/calculator/Calculator.service";
import { AdapterProvider } from "@generated/adapter/types";
import { ModUtils } from "@generated/adapter/mods";
import { BeatmapResolverService } from "@/modules/osu/BeatmapResolver.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { MapViewDto } from "@domain/osu/views/Map.view";
import { MapViewService } from "@/modules/osu/map/MapView.service";
import { GraphService } from "@/modules/osu/Graph.service";
import { AbstractSessionCommand } from "@/commands/AbstractSessionCommand";

@Help(`
    Shows beatmap(set) stats from map url / id.

    A beatmap URL or ID can be provided directly. When providing a beatmapset
    URL or ID, use \`version\` to select a specific difficulty.

    **Beatmap Selection**
    Map: \`map=<url or id>\`, or provide the URL/ID directly.
    Version: \`version=<difficulty name>\`.

    **Difficulty Options**
    Mods: \`mods=<mods>\`, or shorthand: \`+<mods>\`.

    Mods affect difficulty attributes, star rating, map statistics, strains,
    and the displayed performance values.
`)
@Examples("map https://osu.ppy.sh/beatmaps/123456", "map 123456 +hddt")
@Category(ECommandCategory.Osu)
@Command({
    name: "map",
    description: "Shows beatmap(set) stats from map url / id.",
    aliases: ["m", "beatmap", "mapset"],
})
export class MapCommand extends AbstractSessionCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly graphService: GraphService;
    @Import() declare private readonly mapViewService: MapViewService;
    @Import() declare private readonly calculatorService: CalculatorService;
    @Import() declare private readonly beatmapResolverService: BeatmapResolverService;

    @Option("map", "Specify a map url or id")
    @Inject()
    declare private readonly map: CommandOption<string>;

    @Option("version", "Specify a specific difficulty name in the mapset")
    @IsString()
    @Aliases("v")
    declare private readonly version: CommandOption<string>;

    @Option("mods", "Apply mods to calculations (e.g., HDDT)")
    @IsMods()
    declare private readonly mods: CommandOption<ICommandMods>;

    public async execute(ctx: CommandContext): Promise<void> {
        const resolved = await this.beatmapResolverService.resolveTargetWithVersion(
            ctx,
            this.map,
            this.version,
            AdapterProvider.Bancho,
            "lowest",
        );

        if (!resolved.beatmapID || !resolved.beatmapsetID)
            throw new Exception(EApplicationError.NOT_FOUND, "Could not resolve beatmap or mapset.");

        const mapset = await this.osuService.beatmapset(resolved.beatmapsetID, AdapterProvider.Bancho, true);
        if (!mapset || !mapset.beatmaps?.length)
            throw new Exception(EApplicationError.NOT_FOUND, "Beatmapset not found or has no beatmaps.");

        const data: MapViewDto = {
            timestamp: Date.now(),
            authorID: ctx.author.id,
            beatmapset: mapset,
            beatmapID: resolved.beatmapID,
            mods: this.mods.some() ? ModUtils.fromString(this.mods.unwrap().mods) : [],
        };

        await this.respondWithSession(ctx, "osu_map_view", data, this.mapViewService, true);
    }
}
