import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { AmeobeaService } from "./Ameobea.service";

export class AmeobeaController extends AbstractController {
    @Import() declare private readonly ameobeaService: AmeobeaService;

    @On("app", "ready")
    private onAppReady(): void {
        return this.ameobeaService.init();
    }
}
