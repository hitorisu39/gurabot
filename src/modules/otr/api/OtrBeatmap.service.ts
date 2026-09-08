import { AbstractOtrService } from "./AbstractOtrService";
import { plainToInstance } from "class-transformer";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { EOtrKeyType } from "@domain/otr/enums/Otr.enum";
import { otrKeyTypeValue } from "@domain/otr/configs/Otr.config";
import { OtrBeatmapStatsDto } from "@domain/otr/OtrBeatmap.dto";

export class OtrBeatmapService extends AbstractOtrService {
    private readonly statsCacheTtl = 5 * 60;
    private readonly pendingStatsRequests = new Map<number, Promise<OtrBeatmapStatsDto>>();

    public async stats(osuID: number): Promise<OtrBeatmapStatsDto> {
        const cacheKey = `osu:${osuID}`;

        const cached = await this.cache.getInstance("otr_beatmap_stats", OtrBeatmapStatsDto, cacheKey);
        if (cached) return cached;

        const pending = this.pendingStatsRequests.get(osuID);
        if (pending) {
            return await pending;
        }

        const request = this.fetchStats(osuID);
        this.pendingStatsRequests.set(osuID, request);

        try {
            const result = await request;
            await this.cache.set("otr_beatmap_stats", result, this.statsCacheTtl, cacheKey);
            return result;
        } finally {
            this.pendingStatsRequests.delete(osuID);
        }
    }

    private async fetchStats(osuID: number): Promise<OtrBeatmapStatsDto> {
        const data = await this.http.get<OtrBeatmapStatsDto>(`/beatmaps/${osuID}/stats`, {
            params: {
                keyType: otrKeyTypeValue[EOtrKeyType.Osu],
            },
            timeout: this.heavyTimeout,
        });

        if (!data) {
            throw new Exception(EApplicationError.NOT_FOUND, `${this.name} returned no beatmap statistics`);
        }

        return plainToInstance(OtrBeatmapStatsDto, data);
    }
}
