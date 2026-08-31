import { Import, SelectMenu } from "@/core/decorators";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { AbstractSessionComponent } from "@/components/AbstractSessionComponent";
import { MapViewService } from "@/modules/osu/map/MapView.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { MapViewDto } from "@domain/osu/views/Map.view";
import { SearchViewDto } from "@domain/osu/views/Search.view";
import { isValidNumber } from "@domain/utils/utils";

@SelectMenu(/^osu_search_select:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class SearchComponent extends AbstractSessionComponent<"osu_search_view", SearchViewDto> {
    @Import() declare private readonly mapViewService: MapViewService;

    protected readonly sessionKey = "osu_search_view";
    protected readonly dto = SearchViewDto;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;
        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = await this.getData(ctx, sessionID);

        const selectedID = Number(ctx.values[0]);
        if (!isValidNumber(selectedID)) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Invalid beatmapset selection.");
        }

        const mapset = data.beatmapsets.find((candidate) => candidate.id === selectedID);
        if (!mapset) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                "The selected beatmapset is no longer available in this search session.",
            );
        }

        const allBeatmaps = mapset.beatmaps ?? [];

        const filtered =
            data.input.mode !== undefined
                ? allBeatmaps.filter((beatmap) => beatmap.mode === data.input.mode)
                : allBeatmaps;

        const candidates = filtered.length ? filtered : allBeatmaps;
        const beatmap = [...candidates].sort((a, b) => a.difficulty - b.difficulty)[0];

        if (!beatmap) {
            throw new Exception(EApplicationError.NOT_FOUND, "The selected beatmapset has no available difficulties.");
        }

        const mapData: MapViewDto = {
            timestamp: Date.now(),
            authorID: data.authorID,
            beatmapset: mapset,
            beatmapID: beatmap.id,
            mods: [],
        };

        await ctx.deferUpdate();

        const payload = await this.mapViewService.build(sessionID, mapData, true);

        await this.session.transition(
            this.sessionKey,
            "osu_map_view",
            sessionID,
            mapData,
            this.mapViewService.getTtl(),
        );

        await ctx.update(payload);
    }
}
