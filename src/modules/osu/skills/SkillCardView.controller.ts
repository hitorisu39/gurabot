import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { SkillCardViewService } from "./SkillCardView.service";

export class SkillCardViewController extends AbstractController {
    @Import() declare private readonly skillCardViewService: SkillCardViewService;

    @On("app", "ready")
    private async onAppReady(): Promise<void> {
        return await this.skillCardViewService.init();
    }
}
