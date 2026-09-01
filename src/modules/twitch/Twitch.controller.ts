import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { TwitchService } from "./Twitch.service";

export class TwitchController extends AbstractController {
    @Import() declare private readonly twitchService: TwitchService;

    @On("app", "ready")
    private onAppReady(): void {
        return this.twitchService.init();
    }
}
