import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { GuildService } from "./Guild.service";

export class GuildController extends AbstractController {
    @Import() declare private readonly guildService: GuildService;

    @On("app", "ready")
    private async onAppReady(): Promise<void> {
        await this.guildService.init();
    }
}
