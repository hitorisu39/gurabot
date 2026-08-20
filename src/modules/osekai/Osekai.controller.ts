import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { OsekaiService } from "./Osekai.service";

export class OsekaiController extends AbstractController {
    @Import() declare private readonly osekaiService: OsekaiService;

    @On("app", "ready")
    private onAppReady(): void {
        return this.osekaiService.init();
    }
}
