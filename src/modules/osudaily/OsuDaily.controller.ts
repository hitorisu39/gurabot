import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { OsuDailyService } from "./OsuDaily.service";

export class AmeobeaController extends AbstractController {
    @Import() declare private readonly osuDailyService: OsuDailyService;

    @On("app", "ready")
    private onAppReady(): void {
        return this.osuDailyService.init();
    }
}
