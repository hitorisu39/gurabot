import { Aliases, Import, Inject, IsString, Option, Subcommand } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractSessionCommand } from "@/commands/AbstractSessionCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { BeatmapResolverService } from "@/modules/osu/BeatmapResolver.service";
import { OtrService } from "@/modules/otr/api/Otr.service";
import { OtrMapViewService } from "@/modules/otr/views/OtrMapView.service";
import { AdapterProvider } from "@generated/adapter/types";
import { CommandOption } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { EOtrMapView, OtrMapViewDto } from "@domain/otr/views/OtrMap.view";

@Subcommand({
    root: "otr",
    name: "map",
    description: "Shows tournament usage and statistics for an osu! beatmap.",
})
export class OtrMapSubcommand extends AbstractSessionCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly otrService: OtrService;
    @Import() declare private readonly beatmapResolverService: BeatmapResolverService;
    @Import() declare private readonly mapViewService: OtrMapViewService;

    @Option("map", "Specify a map url or id")
    @Inject()
    @IsString()
    declare private readonly map: CommandOption<string>;

    @Option("version", "Specify a specific difficulty name in the mapset")
    @IsString()
    @Aliases("v")
    declare private readonly version: CommandOption<string>;

    public async execute(ctx: CommandContext): Promise<void> {
        const resolved = await this.beatmapResolverService.resolveTargetWithVersion(
            ctx,
            this.map,
            this.version,
            AdapterProvider.Bancho,
            "lowest",
        );

        if (!resolved.beatmapID || !resolved.beatmapsetID) {
            throw new Exception(EApplicationError.NOT_FOUND, "Could not resolve beatmap or mapset.");
        }

        const [beatmapset, stats] = await Promise.all([
            this.osuService.beatmapset(resolved.beatmapsetID, AdapterProvider.Bancho, true),
            this.otrService.beatmapStats(resolved.beatmapID),
        ]);

        if (!beatmapset?.beatmaps?.length) {
            throw new Exception(EApplicationError.NOT_FOUND, "Beatmapset not found or has no beatmaps.");
        }

        const beatmap = beatmapset.beatmaps.find((beatmap) => beatmap.id === resolved.beatmapID);
        if (!beatmap) {
            throw new Exception(EApplicationError.NOT_FOUND, "Beatmap was not found in its beatmapset.");
        }

        const data: OtrMapViewDto = {
            timestamp: Date.now(),
            authorID: ctx.author.id,
            beatmapset,
            beatmapID: beatmap.id,
            stats,
            leaderboardPage: 1,
            tournamentsPage: 1,
        };

        await this.respondWithSession(ctx, "otr_map_view", data, this.mapViewService, EOtrMapView.Overview);
    }
}
