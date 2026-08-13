import { Import } from "@/core/decorators";
import { OsuTrackStatsHistoryDto } from "@domain/osutrack/OsuTrack.dto";
import { GraphOsuTrackHitsService } from "@/modules/osu/graph/GraphOsuTrackHits.service";
import { AbstractGraphOsuTrackCommand, IGraphOsuTrackResult } from "./AbstractGraphOsuTrackCommand";

export abstract class AbstractGraphOsuTrackHitsCommand extends AbstractGraphOsuTrackCommand {
    @Import() declare private readonly graphOsuTrackHitsService: GraphOsuTrackHitsService;

    protected async generateGraph(history: ReadonlyArray<OsuTrackStatsHistoryDto>): Promise<IGraphOsuTrackResult> {
        return {
            image: await this.graphOsuTrackHitsService.generate(history),
            filename: "osutrack-hits",
            title: "osu!track hit history",
        };
    }
}
