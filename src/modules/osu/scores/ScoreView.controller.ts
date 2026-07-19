import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { ScoreViewService } from "./ScoreView.service";

export class ScoreViewController extends AbstractController {
    @Import() declare private readonly scoreViewService: ScoreViewService;

    @On("app", "ready")
    private async onAppReady(): Promise<void> {
        this.scoreViewService.init();
    }
}
