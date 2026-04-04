import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { GraphService } from "./Graph.service";

export class GraphController extends AbstractController {
    @Import() declare private readonly graphService: GraphService;

    @On("app", "ready")
    private async onAppReady(): Promise<void> {
        return await this.graphService.init();
    }
}
