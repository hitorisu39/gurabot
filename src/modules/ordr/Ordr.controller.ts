import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { OrdrService } from "./Ordr.service";

export class OrdrController extends AbstractController {
    @Import() declare private readonly ordrService: OrdrService;

    @On("app", "ready")
    private async onAppReady(): Promise<void> {
        return await this.ordrService.init();
    }
}
