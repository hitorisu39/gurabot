import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { LazerScorepostRendererService } from "./LazerScorepostRenderer.service";

export class LazerScorepostRendererController extends AbstractController {
    @Import() declare private readonly lazerScorepostRendererService: LazerScorepostRendererService;

    @On("app", "ready")
    private async onAppReady(): Promise<void> {
        return await this.lazerScorepostRendererService.init();
    }
}
