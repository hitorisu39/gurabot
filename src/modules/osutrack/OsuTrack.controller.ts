import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { OsuTrackService } from "./OsuTrack.service";

export class OsuTrackController extends AbstractController {
    @Import() declare private readonly osuTrackService: OsuTrackService;

    @On("app", "ready")
    private onAppReady(): void {
        return this.osuTrackService.init();
    }
}
