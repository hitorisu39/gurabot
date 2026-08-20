import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { OsuStatsService } from "./OsuStats.service";

export class OsuStatsController extends AbstractController {
    @Import() declare private readonly osuStatsService: OsuStatsService;

    @On("app", "ready")
    private onAppReady(): void {
        return this.osuStatsService.init();
    }
}
