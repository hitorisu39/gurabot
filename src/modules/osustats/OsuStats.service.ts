import { Trace } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { HttpClient } from "@/http";
import { EModMatchType } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ESortOrder } from "@domain/osu/enums/Score.enum";
import { osuStatsPlayersPageSize } from "@domain/osustats/configs/OsuStats.config";
import { osuStatsBestTimeframeValue } from "@domain/osustats/configs/OsuStatsBest.config";
import { osuStatsScoreSortValue } from "@domain/osustats/configs/OsuStatsScores.config";
import { EOsuStatsBestTimeframe } from "@domain/osustats/enums/OsuStatsBest.enum";
import { OsuStatsErrorResponseDto } from "@domain/osustats/OsuStats.dto";
import { OsuStatsBestScoresDto } from "@domain/osustats/OsuStatsBest.dto";
import { OsuStatsCountsDto } from "@domain/osustats/OsuStatsCounts.dto";
import { OsuStatsPlayerDto, OsuStatsPlayersPageDto } from "@domain/osustats/OsuStatsPlayers.dto";
import { OsuStatsScoresPageDto, OsuStatsScoresRequestDto } from "@domain/osustats/OsuStatsScores.dto";
import { ModUtils } from "@generated/adapter/mods";
import { GameMode } from "@generated/adapter/types";
import { plainToInstance } from "class-transformer";

export interface IOsuStatsPlayersInput {
    mode: GameMode;
    minRank: number;
    maxRank: number;
    page: number;
    country?: string;
}

interface IOsuStatsRawPlayer {
    userId: number;
    count: string;
    osu_user: {
        userName: string;
    };
}

export class OsuStatsService extends AbstractService {
    declare private http: HttpClient;

    private readonly name = "osu!stats";
    private readonly base = "https://osustats.ppy.sh/api";
    private readonly timeout = 15_000;

    private readonly countsCacheTtl = 15 * 60;
    private readonly playersCacheTtl = 6 * 60 * 60;
    private readonly scoresCacheTtl = 6 * 60 * 60;
    private readonly bestCacheTtl = 6 * 60 * 60;

    private readonly pendingCounts = new Map<string, Promise<OsuStatsCountsDto>>();
    private readonly pendingPlayers = new Map<string, Promise<OsuStatsPlayersPageDto>>();
    private readonly pendingScores = new Map<string, Promise<OsuStatsScoresPageDto>>();
    private readonly pendingBest = new Map<string, Promise<OsuStatsBestScoresDto>>();

    public init(): void {
        this.http = new HttpClient(this.logger, {
            name: this.name,
            baseURL: this.base,
        });
    }

    @Trace()
    public async counts(username: string, mode: GameMode): Promise<OsuStatsCountsDto> {
        const cacheKey = `${username.toLowerCase()}:${mode}`;
        const cached = await this.cache.getInstance("osu_stats_counts", OsuStatsCountsDto, cacheKey);
        if (cached) return cached;

        const pending = this.pendingCounts.get(cacheKey);
        if (pending) {
            return await pending;
        }

        const request = this.fetchCounts(username, mode);
        this.pendingCounts.set(cacheKey, request);

        try {
            const result = await request;
            await this.cache.set("osu_stats_counts", result, this.countsCacheTtl, cacheKey);
            return result;
        } finally {
            this.pendingCounts.delete(cacheKey);
        }
    }

    @Trace()
    public async players(data: IOsuStatsPlayersInput): Promise<OsuStatsPlayersPageDto> {
        const country = data.country?.trim().toUpperCase();
        const cacheKey = [data.mode, data.minRank, data.maxRank, country ?? "global", data.page].join(":");
        const cached = await this.cache.getInstance("osu_stats_players", OsuStatsPlayersPageDto, cacheKey);
        if (cached) return cached;

        const pending = this.pendingPlayers.get(cacheKey);
        if (pending) {
            return await pending;
        }

        const request = this.fetchPlayers({
            ...data,
            country,
        });

        this.pendingPlayers.set(cacheKey, request);

        try {
            const result = await request;
            await this.cache.set("osu_stats_players", result, this.playersCacheTtl, cacheKey);
            return result;
        } finally {
            this.pendingPlayers.delete(cacheKey);
        }
    }

    @Trace()
    public async scores(data: OsuStatsScoresRequestDto): Promise<OsuStatsScoresPageDto> {
        const cacheKey = [
            data.username.toLowerCase(),
            data.mode,
            data.page,

            data.minRank,
            data.maxRank,

            data.minAccuracy,
            data.maxAccuracy,

            data.sort,
            data.order,

            data.modType ?? "any",
            data.mods ?? "",
        ].join(":");

        const cached = await this.cache.getInstance("osu_stats_scores", OsuStatsScoresPageDto, cacheKey);
        if (cached) return cached;

        const pending = this.pendingScores.get(cacheKey);
        if (pending) {
            return await pending;
        }

        const request = this.fetchScores(data);
        this.pendingScores.set(cacheKey, request);

        try {
            const result = await request;
            await this.cache.set("osu_stats_scores", result, this.scoresCacheTtl, cacheKey);
            return result;
        } finally {
            this.pendingScores.delete(cacheKey);
        }
    }

    @Trace()
    public async best(timeframe: EOsuStatsBestTimeframe, mode: GameMode): Promise<OsuStatsBestScoresDto> {
        const cacheKey = `${timeframe}:${mode}`;
        const cached = await this.cache.getInstance("osu_stats_best", OsuStatsBestScoresDto, cacheKey);
        if (cached) return cached;

        const pending = this.pendingBest.get(cacheKey);

        if (pending) {
            return await pending;
        }

        const request = this.fetchBest(timeframe, mode);
        this.pendingBest.set(cacheKey, request);

        try {
            const result = await request;
            await this.cache.set("osu_stats_best", result, this.bestCacheTtl, cacheKey);
            return result;
        } finally {
            this.pendingBest.delete(cacheKey);
        }
    }

    private async fetchCounts(username: string, mode: GameMode): Promise<OsuStatsCountsDto> {
        const rankPairs = [
            [100, 50],
            [25, 15],
            [8, 1],
        ] as const;

        const counts = new Map<number, number>();

        let continueFetching = true;

        for (const [higherRank, lowerRank] of rankPairs) {
            if (!continueFetching) {
                counts.set(higherRank, 0);
                counts.set(lowerRank, 0);
                continue;
            }

            const [higherCount, lowerCount] = await Promise.all([
                this.scoreCount(username, mode, higherRank),
                this.scoreCount(username, mode, lowerRank),
            ]);

            counts.set(higherRank, higherCount);
            counts.set(lowerRank, lowerCount);

            if (lowerCount === 0) {
                continueFetching = false;
            }
        }

        return plainToInstance(OsuStatsCountsDto, {
            entries: [1, 8, 15, 25, 50, 100].map((rank) => ({
                rank,
                count: counts.get(rank) ?? 0,
            })),
        });
    }

    private async fetchPlayers(data: IOsuStatsPlayersInput): Promise<OsuStatsPlayersPageDto> {
        const form = new FormData();

        form.append("rankMin", data.minRank.toString());
        form.append("rankMax", data.maxRank.toString());

        form.append("gamemode", this.gamemode(data.mode).toString());

        form.append("page", data.page.toString());

        if (data.country) {
            form.append("country", data.country);
        }

        const response = await this.http.post<Array<IOsuStatsRawPlayer>>("/getScoreRanking", form, {
            timeout: this.timeout,
        });

        if (!Array.isArray(response)) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                `${this.name} returned malformed player ranking data`,
            );
        }

        const players = response.map((player, index): OsuStatsPlayerDto => {
            const userID = Number(player.userId);
            const count = Number(player.count);

            if (!Number.isFinite(userID) || !Number.isFinite(count) || !player.osu_user?.userName) {
                throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned malformed player data`);
            }

            return {
                rank: (data.page - 1) * osuStatsPlayersPageSize + index + 1,
                userID,
                username: player.osu_user.userName,
                count,
            };
        });

        return plainToInstance(OsuStatsPlayersPageDto, {
            players,
        });
    }

    private async fetchScores(data: OsuStatsScoresRequestDto): Promise<OsuStatsScoresPageDto> {
        const form = new FormData();

        form.append("accMin", data.minAccuracy.toString());
        form.append("accMax", data.maxAccuracy.toString());
        form.append("rankMin", data.minRank.toString());
        form.append("rankMax", data.maxRank.toString());
        form.append("gamemode", this.gamemode(data.mode).toString());
        form.append("sortBy", osuStatsScoreSortValue[data.sort].toString());
        form.append("sortOrder", data.order === ESortOrder.Descending ? "0" : "1");
        form.append("page", data.page.toString());
        form.append("u1", data.username);
        const mods = this.formatScoreMods(data);

        if (mods) {
            form.append("mods", mods);
        }

        const response = await this.http.postResponse<unknown>("/getScores", form, {
            timeout: this.timeout,
            validateStatus: (status) => status === 200 || status === 400,
        });

        if (response.status === 400) {
            const error = plainToInstance(OsuStatsErrorResponseDto, response.data);

            if (error.errors?.r?.length) {
                return plainToInstance(OsuStatsScoresPageDto, {
                    scores: [],
                    total: 0,
                });
            }

            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned an invalid request response`);
        }

        if (!Array.isArray(response.data)) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned malformed score data`);
        }

        const rawScores = response.data[0];
        const total = Number(response.data[1]);

        if (!Array.isArray(rawScores) || !Number.isFinite(total) || total < 0) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned malformed score data`);
        }

        return plainToInstance(OsuStatsScoresPageDto, {
            scores: rawScores,
            total,
        });
    }

    private async fetchBest(timeframe: EOsuStatsBestTimeframe, mode: GameMode): Promise<OsuStatsBestScoresDto> {
        const form = new FormData();
        form.append("gamemode", this.gamemode(mode).toString());
        form.append("amount", "100");
        form.append("duration", osuStatsBestTimeframeValue[timeframe].toString());

        const response = await this.http.post<unknown>("/getBestDayScores", form, {
            timeout: this.timeout,
        });

        if (
            !Array.isArray(response) ||
            response.length < 2 ||
            !response[0] ||
            typeof response[0] !== "object" ||
            !Array.isArray(response[1])
        ) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned malformed best score data`);
        }

        const period = response[0] as Record<string, unknown>;
        return plainToInstance(OsuStatsBestScoresDto, {
            startDate: period.start,
            endDate: period.end,
            scores: response[1],
        });
    }

    private async scoreCount(username: string, mode: GameMode, maxRank: number): Promise<number> {
        const form = new FormData();

        form.append("accMin", "0");
        form.append("accMax", "100");

        form.append("rankMin", "1");
        form.append("rankMax", maxRank.toString());

        form.append("gamemode", this.gamemode(mode).toString());

        form.append("sortBy", "0");
        form.append("sortOrder", "0");

        form.append("page", "1");
        form.append("u1", username);

        const response = await this.http.postResponse<unknown>("/getScores", form, {
            timeout: this.timeout,
            validateStatus: (status) => status === 200 || status === 400,
        });

        if (response.status === 400) {
            const error = plainToInstance(OsuStatsErrorResponseDto, response.data);

            if (error.errors?.r?.length) {
                return 0;
            }

            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned an invalid request response`);
        }

        const data = response.data;
        if (!Array.isArray(data) || data.length < 2) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned malformed score data`);
        }

        const count = Number(data[1]);
        if (!Number.isFinite(count) || count < 0) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned an invalid score count`);
        }

        return count;
    }

    private formatScoreMods(data: OsuStatsScoresRequestDto): string | undefined {
        if (!data.modType || data.mods === undefined) {
            return undefined;
        }

        switch (data.modType) {
            case EModMatchType.Include:
                return data.mods ? `+${data.mods}` : "!NM";
            case EModMatchType.Exclude:
                return `-${data.mods}`;
            case EModMatchType.Match: {
                if (!data.mods) {
                    return "!NM";
                }

                const mods = ModUtils.fromString(data.mods);
                const acronyms = mods.map((mod) => mod.acronym);

                if (acronyms.includes("NC") && !acronyms.includes("DT")) {
                    acronyms.push("DT");
                }

                if (acronyms.includes("PF") && !acronyms.includes("SD")) {
                    acronyms.push("SD");
                }

                return `!${acronyms.join("")}`;
            }
        }
    }

    private gamemode(mode: GameMode): number {
        switch (mode) {
            case GameMode.Taiko:
                return 1;
            case GameMode.Catch:
                return 2;
            case GameMode.Mania:
                return 3;
            default:
                return 0;
        }
    }
}
