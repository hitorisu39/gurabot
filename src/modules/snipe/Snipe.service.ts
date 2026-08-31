import { Trace } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { HttpClient } from "@/http";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ESortOrder } from "@domain/osu/enums/Score.enum";
import {
    snipePlayerChangeEndpoint,
    snipePlayerListSortValue,
    snipeRankingSortPath,
} from "@domain/snipe/configs/Snipe.config";
import { ESnipePlayerChangeType, ESnipePlayerListSort, ESnipeRankingSort } from "@domain/snipe/enums/Snipe.enum";
import { SnipeCountriesDto, SnipeCountryStatisticsDto } from "@domain/snipe/SnipeCountry.dto";
import { SnipePlayerDto } from "@domain/snipe/SnipePlayer.dto";
import { SnipePlayerHistoryDto } from "@domain/snipe/SnipePlayerHistory.dto";
import { SnipeRankingDto } from "@domain/snipe/SnipeRanking.dto";
import { SnipeRecentChangesDto } from "@domain/snipe/SnipeRecent.dto";
import { SnipeScoresDto } from "@domain/snipe/SnipeScore.dto";
import { isValidNumber } from "@domain/utils/utils";
import { plainToInstance } from "class-transformer";

export interface ISnipePlayerScoresInput {
    userID: number;
    country: string;
    page: number;
    sort: ESnipePlayerListSort;
    order: ESortOrder;
    mods?: string;
}

export class SnipeService extends AbstractService {
    declare private http: HttpClient;

    private readonly name = "osu!snipe";
    private readonly base = "https://api.snipe.huismetbenen.nl";
    private readonly timeout = 15_000;

    private readonly rankingCacheTtl = 5 * 60;
    private readonly playerCacheTtl = 2 * 60;
    private readonly playerHistoryCacheTtl = 5 * 60;
    private readonly countryStatisticsCacheTtl = 5 * 60;
    private readonly countriesCacheTtl = 6 * 60 * 60;
    private readonly playerScoresCacheTtl = 2 * 60;

    private readonly pendingRankings = new Map<string, Promise<SnipeRankingDto>>();
    private readonly pendingPlayers = new Map<string, Promise<SnipePlayerDto | null>>();
    private readonly pendingPlayerHistories = new Map<string, Promise<SnipePlayerHistoryDto>>();
    private readonly pendingCountryStatistics = new Map<string, Promise<SnipeCountryStatisticsDto>>();
    private readonly pendingCountries = new Map<string, Promise<SnipeCountriesDto>>();
    private readonly pendingPlayerScores = new Map<string, Promise<SnipeScoresDto>>();

    public init(): void {
        this.http = new HttpClient(this.logger, {
            name: this.name,
            baseURL: this.base,
        });
    }

    @Trace()
    public async ranking(
        country: string = "global",
        sort: ESnipeRankingSort = ESnipeRankingSort.WeightedPP,
    ): Promise<SnipeRankingDto> {
        const normalizedCountry = this.country(country, true);
        const cacheKey = `${normalizedCountry}:${sort}`;

        const cached = await this.cache.getInstance("snipe_rankings", SnipeRankingDto, cacheKey);
        if (cached) {
            return cached;
        }

        const pending = this.pendingRankings.get(cacheKey);
        if (pending) {
            return await pending;
        }

        const request = this.fetchRanking(normalizedCountry, sort);
        this.pendingRankings.set(cacheKey, request);

        try {
            const result = await request;
            await this.cache.set("snipe_rankings", result, this.rankingCacheTtl, cacheKey);
            return result;
        } finally {
            this.pendingRankings.delete(cacheKey);
        }
    }

    @Trace()
    public async player(userID: number, country: string): Promise<SnipePlayerDto | null> {
        const normalizedCountry = this.country(country);
        const cacheKey = `${normalizedCountry}:${userID}`;

        const cached = await this.cache.getInstance("snipe_player", SnipePlayerDto, cacheKey);
        if (cached) {
            return cached;
        }

        const pending = this.pendingPlayers.get(cacheKey);
        if (pending) {
            return await pending;
        }

        const request = this.fetchPlayer(normalizedCountry, userID);
        this.pendingPlayers.set(cacheKey, request);

        try {
            const result = await request;
            if (result) {
                await this.cache.set("snipe_player", result, this.playerCacheTtl, cacheKey);
            }

            return result;
        } finally {
            this.pendingPlayers.delete(cacheKey);
        }
    }

    @Trace()
    public async playerHistory(userID: number, country: string): Promise<SnipePlayerHistoryDto> {
        const normalizedCountry = this.country(country);
        const cacheKey = `${normalizedCountry}:${userID}`;

        const cached = await this.cache.getInstance("snipe_player_history", SnipePlayerHistoryDto, cacheKey);
        if (cached) return cached;

        const pending = this.pendingPlayerHistories.get(cacheKey);
        if (pending) {
            return await pending;
        }

        const request = this.fetchPlayerHistory(normalizedCountry, userID);
        this.pendingPlayerHistories.set(cacheKey, request);

        try {
            const result = await request;
            await this.cache.set("snipe_player_history", result, this.playerHistoryCacheTtl, cacheKey);
            return result;
        } finally {
            this.pendingPlayerHistories.delete(cacheKey);
        }
    }

    @Trace()
    public async playerScores(input: ISnipePlayerScoresInput): Promise<SnipeScoresDto> {
        const country = input.country.trim().toUpperCase();
        const mods = this.normalizeMods(input.mods);
        const cacheKey = [country, input.userID, input.page, input.sort, input.order, mods ?? "any"].join(":");
        const cached = await this.cache.getInstance("snipe_player_scores", SnipeScoresDto, cacheKey);

        if (cached) {
            return cached;
        }

        const pending = this.pendingPlayerScores.get(cacheKey);
        if (pending) {
            return await pending;
        }

        const request = this.fetchPlayerScores({
            ...input,
            country,
            mods,
        });

        this.pendingPlayerScores.set(cacheKey, request);

        try {
            const result = await request;
            await this.cache.set("snipe_player_scores", result, this.playerScoresCacheTtl, cacheKey);
            return result;
        } finally {
            this.pendingPlayerScores.delete(cacheKey);
        }
    }

    @Trace()
    public async playerScoreCount(userID: number, country: string, mods?: string): Promise<number> {
        const normalizedCountry = country.trim().toUpperCase();
        const normalizedMods = this.normalizeMods(mods);

        const params = new URLSearchParams();

        if (normalizedMods) {
            params.set("mods", normalizedMods);
        }

        const suffix = params.size ? `?${params}` : "";
        const response = await this.http.get<unknown>(
            `/player/${normalizedCountry.toLowerCase()}/${userID}/topranks/count${suffix}`,
            {
                timeout: this.timeout,
            },
        );

        const count = Number(response);
        if (!isValidNumber(count) || count < 0) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned malformed player score count`);
        }

        return count;
    }

    @Trace()
    public async playerChanges(
        userID: number,
        type: ESnipePlayerChangeType,
        since: Date,
        until: Date = new Date(),
    ): Promise<SnipeRecentChangesDto> {
        return await this.fetchPlayerChanges(userID, type, since, until);
    }

    @Trace()
    public async countryStatistics(country: string): Promise<SnipeCountryStatisticsDto> {
        const normalizedCountry = this.country(country);

        const cached = await this.cache.getInstance(
            "snipe_country_statistics",
            SnipeCountryStatisticsDto,
            normalizedCountry,
        );
        if (cached) {
            return cached;
        }

        const pending = this.pendingCountryStatistics.get(normalizedCountry);
        if (pending) {
            return await pending;
        }

        const request = this.fetchCountryStatistics(normalizedCountry);
        this.pendingCountryStatistics.set(normalizedCountry, request);

        try {
            const result = await request;
            await this.cache.set("snipe_country_statistics", result, this.countryStatisticsCacheTtl, normalizedCountry);
            return result;
        } finally {
            this.pendingCountryStatistics.delete(normalizedCountry);
        }
    }

    @Trace()
    public async countries(): Promise<SnipeCountriesDto> {
        const cacheKey = "all";
        const cached = await this.cache.getInstance("snipe_countries", SnipeCountriesDto, cacheKey);
        if (cached) {
            return cached;
        }

        const pending = this.pendingCountries.get(cacheKey);

        if (pending) {
            return await pending;
        }

        const request = this.fetchCountries();
        this.pendingCountries.set(cacheKey, request);

        try {
            const result = await request;
            await this.cache.set("snipe_countries", result, this.countriesCacheTtl, cacheKey);
            return result;
        } finally {
            this.pendingCountries.delete(cacheKey);
        }
    }

    //#region Fetch

    private async fetchRanking(country: string, sort: ESnipeRankingSort): Promise<SnipeRankingDto> {
        const response = await this.http.get<unknown>(
            `/rankings/${country.toLowerCase()}/${snipeRankingSortPath[sort]}`,
            { timeout: this.timeout },
        );

        if (!Array.isArray(response)) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned malformed ranking data`);
        }

        return plainToInstance(SnipeRankingDto, {
            players: response,
        });
    }

    private async fetchPlayer(country: string, userID: number): Promise<SnipePlayerDto | null> {
        const response = await this.http.get<unknown>(`/player/${country.toLowerCase()}/${userID}?type=id`, {
            timeout: this.timeout,
        });

        if (response === null) {
            return null;
        }

        if (!response || typeof response !== "object" || Array.isArray(response)) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned malformed player data`);
        }

        return plainToInstance(SnipePlayerDto, response);
    }

    private async fetchPlayerHistory(country: string, userID: number): Promise<SnipePlayerHistoryDto> {
        const response = await this.http.get<unknown>(`/player/${country.toLowerCase()}/${userID}/history`, {
            timeout: this.timeout,
        });

        if (!Array.isArray(response)) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned malformed player history`);
        }

        return plainToInstance(SnipePlayerHistoryDto, {
            entries: response,
        });
    }

    private async fetchPlayerScores(input: ISnipePlayerScoresInput): Promise<SnipeScoresDto> {
        const params = new URLSearchParams();

        params.set("sort", snipePlayerListSortValue[input.sort]);
        params.set("order", this.sortOrder(input.order));
        params.set("page", input.page.toString());
        if (input.mods) {
            params.set("mods", input.mods);
        }

        const response = await this.http.get<unknown>(
            `/player/${input.country.toLowerCase()}/${input.userID}/topranks?${params}`,
            {
                timeout: this.timeout,
            },
        );

        if (!Array.isArray(response)) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned malformed player score data`);
        }

        return plainToInstance(SnipeScoresDto, {
            scores: response,
        });
    }

    private async fetchPlayerChanges(
        userID: number,
        type: ESnipePlayerChangeType,
        since: Date,
        until: Date,
    ): Promise<SnipeRecentChangesDto> {
        const params = new URLSearchParams({
            since: this.formatChangeDate(since),
            until: this.formatChangeDate(until),
            includeOwnSnipes: "false",
        });

        const response = await this.http.get<unknown>(
            `/changes/${snipePlayerChangeEndpoint[type]}/${userID}?${params}`,
            { timeout: this.timeout },
        );

        if (!Array.isArray(response)) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned malformed player changes`);
        }

        return plainToInstance(SnipeRecentChangesDto, {
            changes: response,
        });
    }

    private async fetchCountryStatistics(country: string): Promise<SnipeCountryStatisticsDto> {
        const response = await this.http.get<unknown>(`/rankings/${country.toLowerCase()}/statistics`, {
            timeout: this.timeout,
        });

        if (!response || typeof response !== "object" || Array.isArray(response)) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned malformed country statistics`);
        }

        return plainToInstance(SnipeCountryStatisticsDto, response);
    }

    private async fetchCountries(): Promise<SnipeCountriesDto> {
        const response = await this.http.get<unknown>("/country/all?only_with_data=true", {
            timeout: this.timeout,
        });

        if (!Array.isArray(response)) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned malformed country data`);
        }

        return plainToInstance(SnipeCountriesDto, {
            countries: response,
        });
    }

    //#endregion

    //#region Internal

    private country(country: string, allowGlobal: boolean = false): string {
        const normalized = country.trim();

        if (allowGlobal && normalized.toLowerCase() === "global") {
            return "global";
        }

        if (!/^[a-z]{2}$/i.test(normalized)) {
            throw new Exception(EApplicationError.INPUT_ERROR, "Country must be a two-letter country code.");
        }

        return normalized.toUpperCase();
    }

    private normalizeMods(mods?: string): string | undefined {
        if (mods === undefined) {
            return undefined;
        }

        const normalized = mods.trim().toUpperCase();
        if (!normalized || normalized === "NM" || normalized === "NOMOD") {
            return "nomod";
        }

        return normalized;
    }

    private sortOrder(order: ESortOrder): string {
        return order === ESortOrder.Ascending ? "asc" : "desc";
    }

    private formatChangeDate(date: Date): string {
        return `${date.toISOString().slice(0, 19)}Z`;
    }

    //#endregion
}
