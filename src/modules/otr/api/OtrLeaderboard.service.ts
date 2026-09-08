import { Trace } from "@/core/decorators";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { EOtrRuleset } from "@domain/otr/enums/Otr.enum";
import { OtrLeaderboardPageDto } from "@domain/otr/OtrLeaderboard.dto";
import type { IOtrLeaderboardQuery } from "@domain/otr/Otr.types";
import { plainToInstance } from "class-transformer";
import { AbstractOtrService } from "./AbstractOtrService";
import { isValidNumber } from "@domain/utils/utils";

export class OtrLeaderboardService extends AbstractOtrService {
    private readonly leaderboardCacheTtl = 60;
    private readonly pendingRequests = new Map<string, Promise<OtrLeaderboardPageDto>>();

    @Trace()
    public async list(query: IOtrLeaderboardQuery = {}): Promise<OtrLeaderboardPageDto> {
        const { mode, ...filters } = query;
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 10;
        const ruleset = query.ruleset ?? this.gamemode(mode) ?? EOtrRuleset.Standard;
        const country = query.country?.trim().toUpperCase() || undefined;

        if (!isValidNumber(page) || page < 1 || !isValidNumber(pageSize) || pageSize < 1 || pageSize > 100) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Invalid leaderboard page or page size.");
        }

        if (!isValidNumber(ruleset) || ruleset < EOtrRuleset.Standard || ruleset > EOtrRuleset.Mania7K) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Invalid o!TR ruleset.");
        }

        if (country && !/^[A-Z]{2}$/.test(country)) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Use a two-letter country code, such as PL or US.");
        }

        const params = { ...filters, page, pageSize, ruleset, country };
        const cacheKey = JSON.stringify(
            Object.entries(params)
                .filter(([, value]) => value !== undefined)
                .sort(([a], [b]) => a.localeCompare(b)),
        );
        const cached = await this.cache.get("otr_leaderboard", cacheKey);
        if (cached) return plainToInstance(OtrLeaderboardPageDto, cached);

        const pending = this.pendingRequests.get(cacheKey);
        if (pending) return await pending;

        const request = this.fetch(params);
        this.pendingRequests.set(cacheKey, request);

        try {
            const result = await request;
            await this.cache.set("otr_leaderboard", result, this.leaderboardCacheTtl, cacheKey);
            return result;
        } finally {
            this.pendingRequests.delete(cacheKey);
        }
    }

    private async fetch(params: Omit<IOtrLeaderboardQuery, "mode">): Promise<OtrLeaderboardPageDto> {
        const data = await this.http.get<OtrLeaderboardPageDto>("/leaderboard", {
            params,
            timeout: this.heavyTimeout,
        });

        if (!data || data.total < 0) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned invalid leaderboard data`);
        }

        return plainToInstance(OtrLeaderboardPageDto, data);
    }
}
