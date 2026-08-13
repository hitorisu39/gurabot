import { Import } from "@/core/decorators";
import { OsuTrackStatsHistoryDto } from "@domain/osutrack/OsuTrack.dto";
import { GraphOsuTrackPlaycountService } from "@/modules/osu/graph/GraphOsuTrackPlaycount.service";
import { AbstractGraphOsuTrackCommand, IGraphOsuTrackResult } from "./AbstractGraphOsuTrackCommand";

export abstract class AbstractGraphOsuTrackPlaycountCommand extends AbstractGraphOsuTrackCommand {
    @Import() declare private readonly graphOsuTrackPlaycountService: GraphOsuTrackPlaycountService;

    protected async generateGraph(history: ReadonlyArray<OsuTrackStatsHistoryDto>): Promise<IGraphOsuTrackResult> {
        return {
            image: await this.graphOsuTrackPlaycountService.generate(history),
            filename: "osutrack-playcount",
            title: "osu!track playcount history",
        };
    }
}
