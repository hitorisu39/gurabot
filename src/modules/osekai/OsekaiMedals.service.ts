import { Trace } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { HttpClient } from "@/http";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { IOsekaiResponse } from "@domain/osekai/Osekai.dto";
import { OsekaiMedalBeatmapDto, OsekaiMedalCommentDto, OsekaiMedalDto } from "@domain/osekai/OsekaiMedal.dto";
import { levenshtein } from "@domain/utils";
import { plainToInstance } from "class-transformer";

export class OsekaiMedalsService extends AbstractService {
    declare private http: HttpClient;

    private readonly name = "Osekai";
    private readonly base = "https://inex.osekai.net/api";
    private readonly timeout = 5_000;

    /**
     * For how long we want to cache medals data in seconds.
     */
    private readonly medalsCacheTtl = 60 * 60;

    /*
     * Coalesce concurrent get_all calls in this process.
     */
    private pendingMedalsRequest: Promise<Array<OsekaiMedalDto>> | null = null;

    public init(): void {
        this.http = new HttpClient(this.logger, { name: this.name, baseURL: this.base });
    }

    @Trace()
    public async getAll(): Promise<Array<OsekaiMedalDto>> {
        const cached = await this.cache.get("osekai_medals");
        if (cached?.length) return plainToInstance(OsekaiMedalDto, cached);

        if (this.pendingMedalsRequest) return await this.pendingMedalsRequest;
        const request = this.fetchMedals();
        this.pendingMedalsRequest = request;

        try {
            return await request;
        } finally {
            this.pendingMedalsRequest = null;
        }
    }

    @Trace()
    public async get(name: string): Promise<OsekaiMedalDto> {
        const medals = await this.getAll();
        const normalized = this.normalizeName(name);

        const medal = medals.find((medal) => this.normalizeName(medal.name) === normalized);
        if (medal) return medal;

        const suggestions = this.suggestFrom(normalized, medals, 3);
        const suggestionText = suggestions.length
            ? ` Did you mean ${suggestions.map((medal) => `\`${medal.name}\``).join(", ")}?`
            : "";

        throw new Exception(EApplicationError.NOT_FOUND, `Medal \`${name}\` doesn't exist.${suggestionText}`);
    }

    @Trace()
    public async search(query: string, limit: number = 25): Promise<Array<OsekaiMedalDto>> {
        const medals = await this.getAll();
        const normalized = this.normalizeName(query);

        if (!normalized) {
            return medals.slice(0, limit);
        }

        return medals
            .map((medal) => {
                const name = this.normalizeName(medal.name);

                let score = 0;

                if (name === normalized) {
                    score = 4;
                } else if (name.startsWith(normalized)) {
                    score = 3;
                } else if (name.split(" ").some((word) => word.startsWith(normalized))) {
                    score = 2;
                } else if (name.includes(normalized)) {
                    score = 1;
                }

                return {
                    medal,
                    score,
                };
            })
            .filter(({ score }) => score > 0)
            .sort((a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score;
                }

                return a.medal.name.localeCompare(b.medal.name);
            })
            .slice(0, limit)
            .map(({ medal }) => medal);
    }

    @Trace()
    public async beatmaps(medalID: number, limit?: number | null): Promise<Array<OsekaiMedalBeatmapDto>> {
        const response = await this.http.get<IOsekaiResponse<Array<OsekaiMedalBeatmapDto>>>(
            `/medals/${medalID}/beatmaps`,
            { timeout: this.timeout },
        );

        if (!response?.success) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                response?.message || `${this.name} returned an error`,
            );
        }

        const beatmaps = plainToInstance(OsekaiMedalBeatmapDto, response.content ?? []).sort(
            (a, b) => b.votes - a.votes,
        );

        if (limit) return beatmaps.slice(0, limit);
        return beatmaps;
    }

    @Trace()
    public async comments(medalID: number, limit: number = 2): Promise<Array<OsekaiMedalCommentDto>> {
        const response = await this.http.post<IOsekaiResponse<Array<OsekaiMedalCommentDto>>>(
            `/comments/Medals_Data/${medalID}/get`,
            { ParentID: null },
            { timeout: this.timeout },
        );

        if (!response?.success) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                response?.message || `${this.name} returned an error`,
            );
        }

        return plainToInstance(OsekaiMedalCommentDto, response.content ?? [])
            .sort((a, b) => b.votes - a.votes)
            .slice(0, limit);
    }

    private async fetchMedals(): Promise<Array<OsekaiMedalDto>> {
        const response = await this.http.get<IOsekaiResponse<Array<Record<string, unknown>>>>("/medals/get_all", {
            timeout: this.timeout,
        });

        if (!response?.success) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                response?.message || `${this.name} returned an error`,
            );
        }

        if (!response.content?.length)
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned no medals`);

        const medals = plainToInstance(OsekaiMedalDto, response.content);
        await this.cache.set("osekai_medals", medals, this.medalsCacheTtl);

        return medals;
    }

    private suggestFrom(query: string, medals: ReadonlyArray<OsekaiMedalDto>, limit: number): Array<OsekaiMedalDto> {
        if (!query) {
            return [];
        }

        return medals
            .map((medal) => {
                const name = this.normalizeName(medal.name);

                return {
                    medal,
                    score: this.medalSimilarity(query, name),
                };
            })
            .filter(({ score }) => score >= 0.35)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(({ medal }) => medal);
    }

    private medalSimilarity(query: string, name: string): number {
        if (name === query) {
            return 1;
        }

        if (name.startsWith(query)) {
            return 0.9;
        }

        if (name.includes(query)) {
            return 0.8;
        }

        const queryWords = query.split(" ");
        const nameWords = name.split(" ");

        if (queryWords.some((queryWord) => nameWords.some((nameWord) => nameWord.startsWith(queryWord)))) {
            return 0.7;
        }

        const distance = levenshtein(query, name);
        const longest = Math.max(query.length, name.length);

        if (!longest) {
            return 0;
        }

        return 1 - distance / longest;
    }

    private normalizeName(name: string): string {
        return name.trim().replace(/\s+/g, " ").toLowerCase();
    }
}
