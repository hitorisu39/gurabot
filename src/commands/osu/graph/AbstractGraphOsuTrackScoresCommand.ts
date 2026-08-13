import { Import } from "@/core/decorators";
import { OsuTrackStatsHistoryDto } from "@domain/osutrack/OsuTrack.dto";
import { GraphOsuTrackScoresService } from "@/modules/osu/graph/GraphOsuTrackScores.service";
import { AbstractGraphOsuTrackCommand, IGraphOsuTrackResult } from "./AbstractGraphOsuTrackCommand";

export abstract class AbstractGraphOsuTrackScoresCommand extends AbstractGraphOsuTrackCommand {
    @Import() declare private readonly graphOsuTrackScoresService: GraphOsuTrackScoresService;

    protected async generateGraph(history: ReadonlyArray<OsuTrackStatsHistoryDto>): Promise<IGraphOsuTrackResult> {
        return {
            image: await this.graphOsuTrackScoresService.generate(history),
            filename: "osutrack-scores",
            title: "osu!track score history",
        };
    }
}
