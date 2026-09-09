import { Import } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { ChannelService } from "@/modules/channel/Channel.service";
import { BeatmapResolverService } from "@/modules/osu/BeatmapResolver.service";
import { Message, MessageFlags } from "discord.js";

export class BeatmapObserverService extends AbstractService {
    @Import() declare private readonly channelService: ChannelService;
    @Import() declare private readonly beatmapResolverService: BeatmapResolverService;

    /**
     * Inspect a Discord message and, if it contains a beatmap,
     * make that beatmap the current one for the channel.
     */
    public async observe(message: Message, osuOnly = true): Promise<void> {
        /**
         * An ephemeral interaction response is not visible to the
         * channel, so it should not mutate shared channel state.
         */
        if (message.flags.has(MessageFlags.Ephemeral)) {
            return;
        }

        const matched = await this.beatmapResolverService.fromMessage(message, osuOnly);
        if (!matched) {
            return;
        }

        await this.channelService.storeBeatmap(message.channelId, matched);
    }
}
