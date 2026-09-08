import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { OtrPlayerService } from "./OtrPlayer.service";

export class OtrPlayerController extends AbstractController {
    @Import() declare private readonly otrPlayerService: OtrPlayerService;

    @On("app", "ready")
    private async onAppReady(): Promise<void> {
        return await this.otrPlayerService.init();
    }
}
