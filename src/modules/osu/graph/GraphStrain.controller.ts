import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { GraphStrainService } from "./GraphStrain.service";

export class GraphStrainController extends AbstractController {
    @Import() declare private readonly graphStrainService: GraphStrainService;

    @On("app", "ready")
    private async onAppReady(): Promise<void> {
        return await this.graphStrainService.init();
    }
}
