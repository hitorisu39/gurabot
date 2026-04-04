import { CommandContext } from "@/core/discord/context/CommandContext";
import { Command, Import, IsMods, Option } from "@/core/decorators";
import { OsuService } from "@/modules/osu/Osu.service";
import { CommandOption, ICommandMods } from "@domain/core/Command";
import { CalculatorService } from "@/modules/osu/calculator/Calculator.service";
import { AdapterProvider } from "@generated/adapter/types";
import { ModUtils } from "@generated/adapter/mods";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { BeatmapResolverService } from "@/modules/osu/BeatmapResolver.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { MapViewDto } from "@domain/osu/views/Map.view";
import { SessionService } from "@/modules/cache/Session.service";
import { MapViewService } from "@/modules/osu/map/MapView.service";
import { GraphService } from "@/modules/osu/Graph.service";

@Command({
    name: "map",
    description: "Shows beatmap(set) stats from map url / id.",
    aliases: ["m", "beatmap", "mapset"],
})
export class MapCommand extends AbstractCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly graphService: GraphService;
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly mapViewService: MapViewService;
    @Import() declare private readonly calculatorService: CalculatorService;
    @Import() declare private readonly beatmapResolverService: BeatmapResolverService;

    @Option("map", "Specify a map url or id")
    declare private readonly map: CommandOption<string>;

    @Option("mods", "Apply mods to calculations (e.g., HDDT)")
    @IsMods()
    declare private readonly mods: CommandOption<ICommandMods>;

    public async execute(ctx: CommandContext): Promise<void> {
        const stored = await this.beatmapResolverService.resolveCommandTarget(ctx, this.map);

        const mapID = stored.beatmapID;
        let mapsetID = stored.beatmapsetID;

        if (!mapsetID && mapID) {
            const map = await this.osuService.beatmap(mapID);
            if (!map) throw new Exception(EApplicationError.NOT_FOUND, `Beatmap \`${mapID}\` was not found.`);
            mapsetID = map.beatmapsetID;
        }

        if (!mapsetID) throw new Exception(EApplicationError.NOT_FOUND, "Could not determine beatmapset ID.");

        const mapset = await this.osuService.beatmapset(mapsetID, AdapterProvider.Bancho, true);
        if (!mapset || !mapset.beatmaps?.length)
            throw new Exception(EApplicationError.NOT_FOUND, "Beatmapset not found or has no beatmaps.");

        mapset.beatmaps.sort((a, b) => a.difficulty - b.difficulty);
        const targetMapID = mapID || mapset.beatmaps[0]!.id;

        const data: MapViewDto = {
            timestamp: Date.now(),
            authorID: ctx.author.id,
            beatmapset: mapset,
            beatmapID: targetMapID,
            mods: this.mods.some() ? ModUtils.fromString(this.mods.unwrap().mods) : [],
        };

        const sessionID = await this.sessionService.create("osu_map_view", data, this.mapViewService.getTtl());
        const view = await this.mapViewService.build(sessionID, data, true);

        const message = await ctx.respond(view);
        this.sessionService.after(sessionID, () => message?.edit({ components: [] }));
    }
}
