import { Import } from "@/core/decorators";
import { Score } from "@generated/adapter/types";
import { GraphTopRankedDateService } from "@/modules/osu/graph/GraphTopRankedDate.service";
import { AbstractGraphTopCommand, IGraphTopResult } from "./AbstractGraphTopCommand";

export abstract class AbstractGraphTopRankedDateCommand extends AbstractGraphTopCommand {
    @Import() declare private readonly graphTopRankedDateService: GraphTopRankedDateService;

    protected readonly requiresMaps = true;

    protected async generateGraph(scores: ReadonlyArray<Score>): Promise<IGraphTopResult> {
        return {
            image: await this.graphTopRankedDateService.generate(scores),
            filename: "top-ranked-date",
            title: "Top play ranked dates",
        };
    }
}
