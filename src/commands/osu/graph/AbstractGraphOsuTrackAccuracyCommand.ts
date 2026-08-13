import { Import } from "@/core/decorators";
import { OsuTrackStatsHistoryDto } from "@domain/osutrack/OsuTrack.dto";
import { GraphOsuTrackAccuracyService } from "@/modules/osu/graph/GraphOsuTrackAccuracy.service";
import { AbstractGraphOsuTrackCommand, IGraphOsuTrackResult } from "./AbstractGraphOsuTrackCommand";

export abstract class AbstractGraphOsuTrackAccuracyCommand extends AbstractGraphOsuTrackCommand {
    @Import() declare private readonly graphOsuTrackAccuracyService: GraphOsuTrackAccuracyService;

    protected async generateGraph(history: ReadonlyArray<OsuTrackStatsHistoryDto>): Promise<IGraphOsuTrackResult> {
        return {
            image: await this.graphOsuTrackAccuracyService.generate(history),
            filename: "osutrack-accuracy",
            title: "osu!track accuracy history",
        };
    }
}
