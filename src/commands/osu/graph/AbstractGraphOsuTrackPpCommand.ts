import { Import } from "@/core/decorators";
import { OsuTrackStatsHistoryDto } from "@domain/osutrack/OsuTrack.dto";
import { GraphOsuTrackPpService } from "@/modules/osu/graph/GraphOsuTrackPp.service";
import { AbstractGraphOsuTrackCommand, IGraphOsuTrackResult } from "./AbstractGraphOsuTrackCommand";

export abstract class AbstractGraphOsuTrackPpCommand extends AbstractGraphOsuTrackCommand {
    @Import() declare private readonly graphOsuTrackPpService: GraphOsuTrackPpService;

    protected async generateGraph(history: ReadonlyArray<OsuTrackStatsHistoryDto>): Promise<IGraphOsuTrackResult> {
        return {
            image: await this.graphOsuTrackPpService.generate(history),
            filename: "osutrack-pp",
            title: "osu!track PP history",
        };
    }
}
