import { AbstractService } from "@/core/framework/AbstractService";
import { EGraphSize } from "@domain/osu/enums/Graph.enum";
import { ChartConfiguration } from "chart.js";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";

export class GraphRendererService extends AbstractService {
    declare private renderers: Record<EGraphSize, ChartJSNodeCanvas>;

    public async init(): Promise<void> {
        this.renderers = {
            [EGraphSize.Standard]: new ChartJSNodeCanvas({ width: 1100, height: 430, backgroundColour: "transparent" }),
            [EGraphSize.Compact]: new ChartJSNodeCanvas({ width: 900, height: 265, backgroundColour: "transparent" }),
        };
    }

    public async render(size: EGraphSize, config: ChartConfiguration): Promise<Buffer> {
        return await this.renderers[size].renderToBuffer(config);
    }
}
