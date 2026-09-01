import { Import } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { TwitchService } from "@/modules/twitch/Twitch.service";
import { BeatmapUtils } from "@domain/osu/utils/BeatmapUtils";
import { TwitchScoreLinkDto } from "@domain/twitch/Twitch.dto";
import { AdapterProvider, Score } from "@generated/adapter/types";
import { PopulatedScore } from "@domain/osu/Score.dto";
import { PopulatedUser } from "@domain/osu/Profile.dto";

export class TwitchScoreResolverService extends AbstractService {
    @Import() declare private readonly twitchService: TwitchService;

    /**
     * Offset from the calculated beginning of the play so the VOD
     * starts shortly before gameplay begins.
     */
    private readonly vodLeadIn = 3000;
    private readonly maxScoreAge = 14 * 24 * 60 * 60 * 1000;

    public async resolve(profile: PopulatedUser, score: PopulatedScore): Promise<TwitchScoreLinkDto | null> {
        if (!this.isEligible(profile, score)) {
            return null;
        }

        try {
            const link = await this.twitchService.get(profile.id);
            if (!link) return null;

            const liveplay = await this.resolveLiveplay(link.twitchID, score);
            if (liveplay) return liveplay;

            return await this.resolveLive(link.twitchID, score);
        } catch (error) {
            this.logger.warn(
                { error, osuID: profile.id, scoreID: score.id },
                "Failed to resolve Twitch information for score",
            );

            return null;
        }
    }

    private isEligible(profile: PopulatedUser, score: Score): boolean {
        if (profile.provider !== AdapterProvider.Bancho) {
            return false;
        }

        if (!score.passed) {
            return false;
        }

        const endedAt = score.endedAt.getTime();
        const now = Date.now();

        return endedAt <= now && endedAt >= now - this.maxScoreAge;
    }

    private async resolveLiveplay(twitchID: string, score: PopulatedScore): Promise<TwitchScoreLinkDto | null> {
        const videos = await this.twitchService.videos(twitchID);
        const scoreEndedAt = score.endedAt.getTime();

        const vod = videos.find((video) => {
            const startedAt = video.createdAt.getTime();
            const endedAt = startedAt + video.duration * 1000;
            return scoreEndedAt >= startedAt && scoreEndedAt <= endedAt;
        });

        if (!vod) {
            return null;
        }

        const stream = await this.twitchService.stream(twitchID);
        const streamStartedAt = stream && vod.streamID && vod.streamID === stream.id ? stream.startedAt : vod.createdAt;
        const scoreStartedAt = score.startedAt ?? new Date(score.endedAt.getTime() - this.gameplayDuration(score));

        const timestamp = Math.max(
            0,
            Math.ceil((scoreStartedAt.getTime() - streamStartedAt.getTime() - this.vodLeadIn) / 1000),
        );

        return {
            type: "liveplay",
            url: `${vod.url}?t=${this.formatTimestamp(timestamp)}`,
        };
    }

    private async resolveLive(twitchID: string, score: Score): Promise<TwitchScoreLinkDto | null> {
        const stream = await this.twitchService.stream(twitchID);
        if (!stream) {
            return null;
        }

        if (score.endedAt.getTime() < stream.startedAt.getTime()) {
            return null;
        }

        return {
            type: "live",
            url: `https://twitch.tv/${stream.userLogin}`,
        };
    }

    private gameplayDuration(score: PopulatedScore): number {
        const clockRate = score.calculated.difficulty.beatmap.clockRate;
        return BeatmapUtils.length(score.beatmap.totalLength, clockRate) * 1000;
    }

    private formatTimestamp(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${hours}h${minutes}m${remainingSeconds}s`;
    }
}
