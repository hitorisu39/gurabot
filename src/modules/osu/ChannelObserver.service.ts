import { Import } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { ChannelService } from "@/modules/channel/Channel.service";
import { BeatmapResolverService } from "@/modules/osu/BeatmapResolver.service";
import { OsuService } from "@/modules/osu/Osu.service";
import { ScoreResolverService } from "@/modules/osu/ScoreResolver.service";
import { MatchedMapDto } from "@domain/osu/Beatmap.dto";
import { AdapterProvider } from "@generated/adapter/types";
import { Message, MessageFlags } from "discord.js";

export class ChannelObserverService extends AbstractService {
    @Import() declare private readonly channelService: ChannelService;
    @Import() declare private readonly beatmapResolverService: BeatmapResolverService;
    @Import() declare private readonly scoreResolverService: ScoreResolverService;
    @Import() declare private readonly osuService: OsuService;

    /**
     * Inspect a Discord message and make any score and beatmap it contains
     * the current context for the channel.
     */
    public async observe(message: Message, osuOnly = true): Promise<void> {
        /**
         * An ephemeral interaction response is not visible to the
         * channel, so it should not mutate shared channel state.
         */
        if (message.flags.has(MessageFlags.Ephemeral)) {
            return;
        }

        let matchedMap = await this.beatmapResolverService.fromMessage(message, osuOnly);
        const scoreID = this.scoreResolverService.fromMessage(message);

        if (!matchedMap && !scoreID) {
            return;
        }

        if (!scoreID) {
            await this.channelService.storeBeatmap(message.channelId, matchedMap!);
            return;
        }

        if (!matchedMap?.beatmapID) {
            matchedMap = await this.resolveScoreMap(scoreID, matchedMap);
        }

        await this.channelService.storeScore(message.channelId, scoreID, matchedMap);
    }

    private async resolveScoreMap(scoreID: string, matchedMap: MatchedMapDto | null): Promise<MatchedMapDto | null> {
        try {
            const score = await this.osuService.score(scoreID, AdapterProvider.Bancho);

            return {
                beatmapID: score.beatmapID,
                beatmapsetID: score.beatmap?.beatmapsetID ?? score.beatmapset?.id ?? matchedMap?.beatmapsetID ?? null,
            };
        } catch (error) {
            this.logger.debug(error, `Could not resolve beatmap context for observed score ${scoreID}.`);
            return matchedMap;
        }
    }
}
