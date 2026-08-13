import { Import } from "@/core/decorators";
import { Score } from "@generated/adapter/types";
import { GraphTopPpService } from "@/modules/osu/graph/GraphTopPp.service";
import { AbstractGraphTopCommand, IGraphTopResult } from "./AbstractGraphTopCommand";

export abstract class AbstractGraphTopPpCommand extends AbstractGraphTopCommand {
    @Import() declare private readonly graphTopPpService: GraphTopPpService;

    protected async generateGraph(scores: ReadonlyArray<Score>): Promise<IGraphTopResult> {
        return {
            image: await this.graphTopPpService.generate(scores),
            filename: "top-pp",
            title: "Top play PP distribution",
        };
    }
}
