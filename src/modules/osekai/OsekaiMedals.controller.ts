import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { OsekaiMedalsService } from "./OsekaiMedals.service";

export class OsekaiMedalsController extends AbstractController {
    @Import() declare private readonly osekaiMedalsService: OsekaiMedalsService;

    @On("app", "ready")
    private onAppReady(): void {
        return this.osekaiMedalsService.init();
    }
}
