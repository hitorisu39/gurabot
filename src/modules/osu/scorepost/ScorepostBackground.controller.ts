import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { ScorepostBackgroundService } from "./ScorepostBackground.service";

export class ScorepostBackgroundController extends AbstractController {
    @Import() declare private readonly scorepostBackgroundService: ScorepostBackgroundService;

    @On("app", "ready")
    private onAppReady(): void {
        return this.scorepostBackgroundService.init();
    }
}
