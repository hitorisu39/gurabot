import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { BeatmapObserverService } from "./BeatmapObserver.service";
import { type IDiscordResponseEvent } from "@/core/discord/context/DiscordContext";

export class BeatmapObserverController extends AbstractController {
    @Import() declare private readonly beatmapObserverService: BeatmapObserverService;

    @On("discord", "response")
    private async onDiscordResponse(event: IDiscordResponseEvent): Promise<void> {
        return await this.beatmapObserverService.observe(event.message, true);
    }
}
