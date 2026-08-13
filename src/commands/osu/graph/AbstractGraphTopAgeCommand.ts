import { Import } from "@/core/decorators";
import { Score } from "@generated/adapter/types";
import { GraphTopAgeService } from "@/modules/osu/graph/GraphTopAge.service";
import { AbstractGraphTopCommand, IGraphTopResult } from "./AbstractGraphTopCommand";

export abstract class AbstractGraphTopAgeCommand extends AbstractGraphTopCommand {
    @Import() declare private readonly graphTopAgeService: GraphTopAgeService;

    protected async generateGraph(scores: ReadonlyArray<Score>): Promise<IGraphTopResult> {
        return {
            image: await this.graphTopAgeService.generate(scores),
            filename: "top-age",
            title: "Top play history",
        };
    }
}
