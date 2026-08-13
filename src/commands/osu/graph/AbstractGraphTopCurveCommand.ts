import { Import } from "@/core/decorators";
import { Score } from "@generated/adapter/types";
import { GraphTopCurveService } from "@/modules/osu/graph/GraphTopCurve.service";
import { AbstractGraphTopCommand, IGraphTopResult } from "./AbstractGraphTopCommand";

export abstract class AbstractGraphTopCurveCommand extends AbstractGraphTopCommand {
    @Import() declare private readonly graphTopCurveService: GraphTopCurveService;

    protected async generateGraph(scores: ReadonlyArray<Score>): Promise<IGraphTopResult> {
        return {
            image: await this.graphTopCurveService.generate(scores),
            filename: "top-curve",
            title: "Top play PP curve",
        };
    }
}
