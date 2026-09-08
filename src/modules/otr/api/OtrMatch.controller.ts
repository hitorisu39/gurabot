import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { OtrMatchService } from "./OtrMatch.service";

export class OtrMatchController extends AbstractController {
    @Import() declare private readonly otrMatchService: OtrMatchService;

    @On("app", "ready")
    private async onAppReady(): Promise<void> {
        return await this.otrMatchService.init();
    }
}
