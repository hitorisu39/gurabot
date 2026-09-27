import { type IDiscordResponseEvent } from "@/core/discord/context/DiscordContext";
import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { ChannelObserverService } from "./ChannelObserver.service";

export class ChannelObserverController extends AbstractController {
    @Import() declare private readonly channelObserverService: ChannelObserverService;

    @On("discord", "response")
    private async onDiscordResponse(event: IDiscordResponseEvent): Promise<void> {
        return await this.channelObserverService.observe(event.message, true);
    }
}
