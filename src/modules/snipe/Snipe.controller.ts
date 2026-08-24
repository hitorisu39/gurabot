import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { SnipeService } from "./Snipe.service";

export class SnipeController extends AbstractController {
    @Import() declare private readonly snipeService: SnipeService;

    @On("app", "ready")
    private onAppReady(): void {
        return this.snipeService.init();
    }
}
