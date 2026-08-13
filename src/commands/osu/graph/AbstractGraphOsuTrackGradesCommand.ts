import { Import } from "@/core/decorators";
import { OsuTrackStatsHistoryDto } from "@domain/osutrack/OsuTrack.dto";
import { GraphOsuTrackGradesService } from "@/modules/osu/graph/GraphOsuTrackGrades.service";
import { AbstractGraphOsuTrackCommand, IGraphOsuTrackResult } from "./AbstractGraphOsuTrackCommand";

export abstract class AbstractGraphOsuTrackGradesCommand extends AbstractGraphOsuTrackCommand {
    @Import() declare private readonly graphOsuTrackGradesService: GraphOsuTrackGradesService;

    protected async generateGraph(history: ReadonlyArray<OsuTrackStatsHistoryDto>): Promise<IGraphOsuTrackResult> {
        return {
            image: await this.graphOsuTrackGradesService.generate(history),
            filename: "osutrack-grades",
            title: "osu!track grade history",
        };
    }
}
