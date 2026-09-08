import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { OtrLeaderboardService } from "./OtrLeaderboard.service";

export class OtrLeaderboardController extends AbstractController {
    @Import() declare private readonly otrLeaderboardService: OtrLeaderboardService;

    @On("app", "ready")
    private async onAppReady(): Promise<void> {
        return await this.otrLeaderboardService.init();
    }
}
