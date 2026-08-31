import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { OsuMapsetDownloadService } from "./OsuMapsetDownload.service";

export class OsuMapsetDownloadController extends AbstractController {
    @Import() declare private readonly osuMapsetDownloadService: OsuMapsetDownloadService;

    @On("app", "ready")
    private async onAppReady(): Promise<void> {
        return await this.osuMapsetDownloadService.init();
    }
}
