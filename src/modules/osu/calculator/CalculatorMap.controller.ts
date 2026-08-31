import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { CalculatorMapService } from "./CalculatorMap.service";

export class CalculatorMapController extends AbstractController {
    @Import() declare private readonly calculatorMapService: CalculatorMapService;

    @On("app", "ready")
    private async onAppReady(): Promise<void> {
        return await this.calculatorMapService.init();
    }
}
