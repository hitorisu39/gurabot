import { Trace } from "@/core/decorators";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { EOtrKeyType, EOtrRuleset } from "@domain/otr/enums/Otr.enum";
import { OtrPlayerDto, OtrPlayerRatingDto, OtrPlayerStatsDto, OtrPlayerTournamentDto } from "@domain/otr/OtrPlayer.dto";
import type { IOtrPlayerStatsQuery, IOtrPlayerTournamentsQuery } from "@domain/otr/Otr.types";
import { plainToInstance } from "class-transformer";
import { AbstractOtrService } from "./AbstractOtrService";
import { isValidNumber } from "@domain/utils/utils";
import { otrKeyTypeValue } from "@domain/otr/configs/Otr.config";

export class OtrPlayerService extends AbstractOtrService {
    private readonly playerCacheTtl = 5 * 60;
    private readonly playerStatsCacheTtl = 2 * 60;
    private readonly playerTournamentsCacheTtl = 5 * 60;

    private readonly pendingPlayerRequests = new Map<string, Promise<OtrPlayerDto>>();
    private readonly pendingPlayerStatsRequests = new Map<string, Promise<OtrPlayerStatsDto>>();
    private readonly pendingPlayerTournamentRequests = new Map<string, Promise<Array<OtrPlayerTournamentDto>>>();
    private readonly pendingPlayerRatingsRequests = new Map<string, Promise<Array<OtrPlayerRatingDto>>>();

    @Trace()
    public async get(id: number | string, keyType: EOtrKeyType): Promise<OtrPlayerDto> {
        const key = this.normalizePlayerKey(id, keyType);
        const cacheKey = `${keyType}:${key}`;

        const cached = await this.cache.getInstance("otr_player", OtrPlayerDto, cacheKey);
        if (cached) return cached;

        const pending = this.pendingPlayerRequests.get(cacheKey);
        if (pending) return await pending;

        const request = this.fetchPlayer(key, keyType);
        this.pendingPlayerRequests.set(cacheKey, request);

        try {
            const result = await request;
            await this.cache.set("otr_player", result, this.playerCacheTtl, cacheKey);
            return result;
        } finally {
            this.pendingPlayerRequests.delete(cacheKey);
        }
    }

    @Trace()
    public async stats(
        id: number | string,
        keyType: EOtrKeyType,
        query: IOtrPlayerStatsQuery = {},
    ): Promise<OtrPlayerStatsDto> {
        const key = this.normalizePlayerKey(id, keyType);
        const ruleset = this.gamemode(query.mode);
        const dateMin = this.date(query.dateMin);
        const dateMax = this.date(query.dateMax);

        const cacheKey = [keyType, key, ruleset ?? "default", dateMin ?? "all", dateMax ?? "all"].join(":");

        const cached = await this.cache.getInstance("otr_player_stats", OtrPlayerStatsDto, cacheKey);
        if (cached) return cached;

        const pending = this.pendingPlayerStatsRequests.get(cacheKey);
        if (pending) return await pending;

        const request = this.fetchPlayerStats(key, keyType, ruleset, dateMin, dateMax);
        this.pendingPlayerStatsRequests.set(cacheKey, request);

        try {
            const result = await request;
            await this.cache.set("otr_player_stats", result, this.playerStatsCacheTtl, cacheKey);
            return result;
        } finally {
            this.pendingPlayerStatsRequests.delete(cacheKey);
        }
    }

    @Trace()
    public async tournaments(
        id: number | string,
        keyType: EOtrKeyType,
        query: IOtrPlayerTournamentsQuery = {},
    ): Promise<Array<OtrPlayerTournamentDto>> {
        const key = this.normalizePlayerKey(id, keyType);
        const ruleset = this.gamemode(query.mode);
        const dateMin = this.date(query.dateMin);
        const dateMax = this.date(query.dateMax);

        const cacheKey = [keyType, key, ruleset ?? "default", dateMin ?? "all", dateMax ?? "all"].join(":");

        const cached = await this.cache.get("otr_player_tournaments", cacheKey);
        if (cached) return plainToInstance(OtrPlayerTournamentDto, cached);

        const pending = this.pendingPlayerTournamentRequests.get(cacheKey);
        if (pending) return await pending;

        const request = this.fetchPlayerTournaments(key, keyType, ruleset, dateMin, dateMax);
        this.pendingPlayerTournamentRequests.set(cacheKey, request);

        try {
            const result = await request;
            await this.cache.set("otr_player_tournaments", result, this.playerTournamentsCacheTtl, cacheKey);
            return result;
        } finally {
            this.pendingPlayerTournamentRequests.delete(cacheKey);
        }
    }

    @Trace()
    public async ratings(osuIDs: ReadonlyArray<number>, ruleset: EOtrRuleset): Promise<Array<OtrPlayerRatingDto>> {
        const ids = Array.from(new Set(osuIDs.filter((id) => Number.isSafeInteger(id) && id > 0)));
        if (!ids.length) return [];

        const ratings: Array<OtrPlayerRatingDto> = [];

        for (let offset = 0; offset < ids.length; offset += 50) {
            const chunk = ids.slice(offset, offset + 50);
            ratings.push(...(await this.ratingsChunk(chunk, ruleset)));
        }

        const byOsuID = new Map(ratings.map((rating) => [rating.osuID, rating]));

        return ids.flatMap((id) => {
            const rating = byOsuID.get(id);
            return rating ? [rating] : [];
        });
    }

    private async fetchPlayer(id: number | string, keyType: EOtrKeyType): Promise<OtrPlayerDto> {
        const data = await this.http.get<OtrPlayerDto>(`/players/${encodeURIComponent(String(id))}`, {
            params: { keyType: otrKeyTypeValue[keyType] },
            timeout: this.timeout,
        });

        if (!data) {
            throw new Exception(EApplicationError.NOT_FOUND, `${this.name} returned no player`);
        }

        return plainToInstance(OtrPlayerDto, data);
    }

    private async fetchPlayerStats(
        id: number | string,
        keyType: EOtrKeyType,
        ruleset?: EOtrRuleset,
        dateMin?: string,
        dateMax?: string,
    ): Promise<OtrPlayerStatsDto> {
        const data = await this.http.get<OtrPlayerStatsDto>(`/players/${encodeURIComponent(String(id))}/stats`, {
            params: {
                keyType: otrKeyTypeValue[keyType],
                ruleset,
                dateMin,
                dateMax,
            },
            timeout: this.heavyTimeout,
        });

        if (!data) {
            throw new Exception(EApplicationError.NOT_FOUND, `${this.name} returned no player stats`);
        }

        return plainToInstance(OtrPlayerStatsDto, data);
    }

    private async fetchPlayerTournaments(
        id: number | string,
        keyType: EOtrKeyType,
        ruleset?: EOtrRuleset,
        dateMin?: string,
        dateMax?: string,
    ): Promise<Array<OtrPlayerTournamentDto>> {
        const data = await this.http.get<Array<OtrPlayerTournamentDto>>(
            `/players/${encodeURIComponent(String(id))}/tournaments`,
            {
                params: {
                    keyType: otrKeyTypeValue[keyType],
                    ruleset,
                    dateMin,
                    dateMax,
                },
                timeout: this.timeout,
            },
        );

        if (!Array.isArray(data)) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                `${this.name} returned invalid player tournament data`,
            );
        }

        return plainToInstance(OtrPlayerTournamentDto, data);
    }

    private async ratingsChunk(
        osuIDs: ReadonlyArray<number>,
        ruleset: EOtrRuleset,
    ): Promise<Array<OtrPlayerRatingDto>> {
        const requestKey = `${ruleset}:${[...osuIDs].sort((a, b) => a - b).join(",")}`;

        const pending = this.pendingPlayerRatingsRequests.get(requestKey);
        if (pending) return await pending;

        const request = this.fetchPlayerRatings(osuIDs, ruleset);
        this.pendingPlayerRatingsRequests.set(requestKey, request);

        try {
            return await request;
        } finally {
            this.pendingPlayerRatingsRequests.delete(requestKey);
        }
    }

    private async fetchPlayerRatings(
        osuIDs: ReadonlyArray<number>,
        ruleset: EOtrRuleset,
    ): Promise<Array<OtrPlayerRatingDto>> {
        const data = await this.http.post<Array<OtrPlayerRatingDto>>(
            "/players/ratings",
            {
                osuIds: osuIDs,
                ruleset,
            },
            {
                timeout: this.timeout,
            },
        );

        if (!Array.isArray(data)) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned invalid player rating data`);
        }

        return plainToInstance(OtrPlayerRatingDto, data);
    }

    private normalizePlayerKey(id: number | string, keyType: EOtrKeyType): number | string {
        if (typeof id === "number") {
            if (!isValidNumber(id) || id <= 0) {
                throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} received an invalid player ID`);
            }

            return id;
        }

        const value = id.trim();
        if (!value) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} received an empty player key`);
        }

        if (keyType === EOtrKeyType.Username) return value.toLowerCase();
        if (keyType === EOtrKeyType.Osu || keyType === EOtrKeyType.Otr) {
            const numeric = Number(value);
            if (!isValidNumber(numeric) || numeric <= 0) {
                throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} received an invalid player ID`);
            }

            return numeric;
        }

        return value;
    }
}
