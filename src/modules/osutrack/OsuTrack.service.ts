import { EApplicationError, Exception } from "@domain/core/Exception";
import { Trace } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { HttpClient } from "@/http";
import { AdapterProvider, GameMode } from "@generated/adapter/types";
import { plainToInstance } from "class-transformer";
import { OsuTrackPeakDto, OsuTrackStatsHistoryDto } from "@domain/osutrack/OsuTrack.dto";

export class OsuTrackService extends AbstractService {
    declare private http: HttpClient;

    private readonly name = "osu!track";
    private readonly base = "https://osutrack-api.ameo.dev";

    private readonly timeout = 1_000;
    private readonly historyTimeout = 10_000;

    /*
     * History changes relatively slowly and is comparatively expensive
     * to fetch, so avoid repeatedly downloading the entire dataset.
     */
    private readonly historyCacheTTL = 15 * 60;

    /*
     * Coalesce concurrent requests for the same user/mode within this
     * process so a cache miss doesn't result in several identical large
     * upstream requests at once.
     */
    private readonly pendingHistoryRequests = new Map<string, Promise<Array<OsuTrackStatsHistoryDto>>>();

    public init(): void {
        this.http = new HttpClient(this.logger, {
            name: this.name,
            baseURL: this.base,
        });
    }

    @Trace()
    public async peak(userID: number, mode: GameMode, provider: AdapterProvider): Promise<OsuTrackPeakDto> {
        this.validateProvider(provider);

        const data = await this.http.get<Array<OsuTrackPeakDto>>("/peak", {
            params: {
                user: userID,
                mode: this.gamemode(mode),
            },
            timeout: this.timeout,
        });

        const peak = data?.at(0);

        if (!peak) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned no data`);
        }

        return plainToInstance(OsuTrackPeakDto, peak);
    }

    @Trace()
    public async history(
        userID: number,
        mode: GameMode,
        provider: AdapterProvider,
    ): Promise<Array<OsuTrackStatsHistoryDto>> {
        this.validateProvider(provider);

        const modeID = this.gamemode(mode);
        const cacheID = `${userID}:${modeID}`;

        const cached = await this.cache.get("osutrack_stats_history", cacheID);
        if (cached?.length) {
            return plainToInstance(OsuTrackStatsHistoryDto, cached);
        }

        const pending = this.pendingHistoryRequests.get(cacheID);
        if (pending) {
            return await pending;
        }

        const request = this.fetchHistory(userID, modeID, cacheID);

        this.pendingHistoryRequests.set(cacheID, request);

        try {
            return await request;
        } finally {
            this.pendingHistoryRequests.delete(cacheID);
        }
    }

    private async fetchHistory(
        userID: number,
        modeID: number,
        cacheID: string,
    ): Promise<Array<OsuTrackStatsHistoryDto>> {
        const data = await this.http.get<Array<OsuTrackStatsHistoryDto>>("/stats_history", {
            params: {
                user: userID,
                mode: modeID,
            },
            timeout: this.historyTimeout,
        });

        if (!data?.length) {
            throw new Exception(EApplicationError.NOT_FOUND, `${this.name} returned no stats history`);
        }

        const history = this.normalizeHistory(plainToInstance(OsuTrackStatsHistoryDto, data));
        if (!history.length) {
            throw new Exception(EApplicationError.NOT_FOUND, `${this.name} returned no valid stats history`);
        }

        await this.cache.set("osutrack_stats_history", history, this.historyCacheTTL, cacheID);

        return history;
    }

    private normalizeHistory(history: ReadonlyArray<OsuTrackStatsHistoryDto>): Array<OsuTrackStatsHistoryDto> {
        const byTimestamp = new Map<number, OsuTrackStatsHistoryDto>();

        for (const entry of history) {
            const timestamp = entry.timestamp.getTime();

            if (!Number.isFinite(timestamp)) {
                continue;
            }

            byTimestamp.set(timestamp, entry);
        }

        return Array.from(byTimestamp.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }

    private validateProvider(provider: AdapterProvider): void {
        if (provider !== AdapterProvider.Bancho) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} only supports Bancho users.`);
        }
    }

    private gamemode(mode: GameMode): number {
        switch (mode) {
            case GameMode.Standard:
                return 0;
            case GameMode.Taiko:
                return 1;
            case GameMode.Catch:
                return 2;
            case GameMode.Mania:
                return 3;
        }
    }
}
