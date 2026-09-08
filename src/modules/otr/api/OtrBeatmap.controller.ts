import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { OtrBeatmapService } from "./OtrBeatmap.service";

export class OtrBeatmapController extends AbstractController {
    @Import() declare private readonly otrBeatmapService: OtrBeatmapService;

    @On("app", "ready")
    private async onAppReady(): Promise<void> {
        return await this.otrBeatmapService.init();
    }
}
