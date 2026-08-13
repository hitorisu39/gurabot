import { Import } from "@/core/decorators";
import { OsuTrackStatsHistoryDto } from "@domain/osutrack/OsuTrack.dto";
import { GraphOsuTrackRankService } from "@/modules/osu/graph/GraphOsuTrackRank.service";
import { AbstractGraphOsuTrackCommand, IGraphOsuTrackResult } from "./AbstractGraphOsuTrackCommand";

export abstract class AbstractGraphOsuTrackRankCommand extends AbstractGraphOsuTrackCommand {
    @Import() declare private readonly graphOsuTrackRankService: GraphOsuTrackRankService;

    protected async generateGraph(history: ReadonlyArray<OsuTrackStatsHistoryDto>): Promise<IGraphOsuTrackResult> {
        return {
            image: await this.graphOsuTrackRankService.generate(history),
            filename: "osutrack-rank",
            title: "osu!track rank history",
        };
    }
}
