import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { StableScorepostRendererService } from "./StableScorepostRenderer.service";

export class StableScorepostRendererController extends AbstractController {
    @Import() declare private readonly stableScorepostRendererService: StableScorepostRendererService;

    @On("app", "ready")
    private async onAppReady(): Promise<void> {
        return await this.stableScorepostRendererService.init();
    }
}
