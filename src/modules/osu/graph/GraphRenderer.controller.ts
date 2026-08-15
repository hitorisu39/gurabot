import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { GraphRendererService } from "./GraphRenderer.service";

export class GraphRendererController extends AbstractController {
    @Import() declare private readonly graphRendererService: GraphRendererService;

    @On("app", "ready")
    private async onAppReady(): Promise<void> {
        return await this.graphRendererService.init();
    }
}
