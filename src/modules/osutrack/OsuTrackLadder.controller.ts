import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { OsuTrackLadderService } from "./OsuTrackLadder.service";

export class OsuTrackLadderController extends AbstractController {
    @Import() declare private readonly osuTrackLadderService: OsuTrackLadderService;

    @On("app", "ready")
    private onAppReady(): void {
        return this.osuTrackLadderService.init();
    }
}
