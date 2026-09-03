import { TRepository } from "@/core";
import { Trace } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { HttpClient } from "@/http";
import { EApplicationError, Exception } from "@domain/core/Exception";
import {
    OsuToTwitchDto,
    TwitchIdentityDto,
    TwitchStreamDto,
    TwitchStreamsResponseDto,
    TwitchTokenDto,
    TwitchVideoDto,
    TwitchVideosResponseDto,
} from "@domain/twitch/Twitch.dto";
import { plainToInstance } from "class-transformer";

export class TwitchService extends AbstractService {
    declare private apiHttp: HttpClient;
    declare private authHttp: HttpClient;

    private readonly name = "Twitch";

    private readonly apiBase = "https://api.twitch.tv/helix";
    private readonly authBase = "https://id.twitch.tv/oauth2";

    private readonly timeout = 3_000;
    private readonly authTimeout = 5_000;

    private readonly videosCacheTtl = 3 * 60;
    private readonly streamCacheTtl = 30;

    /**
     * Refresh a little before Twitch considers the app token expired.
     */
    private readonly tokenExpiryLeeway = 60_000;

    private appAccessToken: string | null = null;
    private appAccessTokenExpiresAt = 0;

    /**
     * Prevent concurrent Twitch requests from all requesting their own
     * application access token after a cache miss / expiration.
     */
    private pendingAccessToken: Promise<string> | null = null;

    public init(): void {
        this.apiHttp = new HttpClient(this.logger, {
            name: `${this.name}:API`,
            baseURL: this.apiBase,
        });

        this.authHttp = new HttpClient(this.logger, {
            name: `${this.name}:Auth`,
            baseURL: this.authBase,
        });
    }

    //#region Links

    public async link(osuID: number, twitchID: string, repository?: TRepository): Promise<OsuToTwitchDto> {
        const cb = async (repo: TRepository): Promise<OsuToTwitchDto> => {
            const existing = await repo.osuToTwitch.findUnique({
                where: {
                    twitchID,
                },
            });

            if (existing && existing.osuID !== osuID) {
                throw new Exception(
                    EApplicationError.INPUT_ERROR,
                    "That Twitch account is already linked to another osu! account.",
                );
            }

            const link = await repo.osuToTwitch.upsert({
                where: {
                    osuID,
                },
                create: {
                    osuID,
                    twitchID,
                },
                update: {
                    twitchID,
                },
            });

            return plainToInstance(OsuToTwitchDto, link);
        };

        return repository ? cb(repository) : this.repository.$transaction(cb);
    }

    public async unlink(osuID: number, repository?: TRepository): Promise<boolean> {
        const cb = async (repo: TRepository): Promise<boolean> => {
            const result = await repo.osuToTwitch.deleteMany({
                where: {
                    osuID,
                },
            });

            return result.count > 0;
        };

        return cb(repository ?? this.repository);
    }

    public async get(osuID: number, repository?: TRepository): Promise<OsuToTwitchDto | null> {
        const cb = async (repo: TRepository): Promise<OsuToTwitchDto | null> => {
            const link = await repo.osuToTwitch.findUnique({
                where: {
                    osuID,
                },
            });

            return plainToInstance(OsuToTwitchDto, link);
        };

        return cb(repository ?? this.repository);
    }

    public async getByTwitchID(twitchID: string, repository?: TRepository): Promise<OsuToTwitchDto | null> {
        const cb = async (repo: TRepository): Promise<OsuToTwitchDto | null> => {
            const link = await repo.osuToTwitch.findUnique({
                where: {
                    twitchID,
                },
            });

            return plainToInstance(OsuToTwitchDto, link);
        };

        return cb(repository ?? this.repository);
    }

    //#endregion

    //#region OAuth

    /**
     * Exchanges an authorization code received from Twitch OAuth.
     */
    @Trace()
    public async exchangeCode(code: string): Promise<TwitchTokenDto> {
        const body = new URLSearchParams({
            client_id: this.config.twitch.client_id,
            client_secret: this.config.twitch.client_secret,
            code,
            grant_type: "authorization_code",
            redirect_uri: this.config.twitch.redirect_uri,
        });

        const response = await this.authHttp.post<TwitchTokenDto>("/token", body.toString(), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout: this.authTimeout,
        });

        const token = plainToInstance(TwitchTokenDto, response);
        if (!token.accessToken) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned no OAuth access token.`);
        }

        return token;
    }

    /**
     * Resolves the Twitch identity belonging to an OAuth access token.
     */
    @Trace()
    public async identity(accessToken: string): Promise<TwitchIdentityDto> {
        const response = await this.authHttp.get<TwitchIdentityDto>("/userinfo", {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            timeout: this.authTimeout,
        });

        const identity = plainToInstance(TwitchIdentityDto, response);
        if (!identity.sub) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned no user ID.`);
        }

        return identity;
    }

    //#endregion

    //#region API

    /**
     * Returns recent archived broadcasts for a Twitch user.
     *
     * The score liveplay feature only considers osu! scores from the
     * previous two weeks, so a one-month Twitch window is sufficient.
     */
    @Trace()
    public async videos(userID: string): Promise<Array<TwitchVideoDto>> {
        const cached = await this.cache.get("twitch_videos", userID);
        if (cached) {
            return plainToInstance(TwitchVideoDto, cached);
        }

        const accessToken = await this.getAppAccessToken();
        const response = await this.apiHttp.get<TwitchVideosResponseDto>("/videos", {
            params: {
                user_id: userID,
                type: "archive",
                period: "month",
                sort: "time",
                first: 100,
            },
            headers: this.apiHeaders(accessToken),
            timeout: this.timeout,
        });

        const data = plainToInstance(TwitchVideosResponseDto, response);
        const videos = data.data ?? [];

        await this.cache.set("twitch_videos", videos, this.videosCacheTtl, userID);

        return videos;
    }

    /**
     * Returns the user's current Twitch stream, or null if offline.
     */
    @Trace()
    public async stream(userID: string): Promise<TwitchStreamDto | null> {
        const cached = await this.cache.getInstance("twitch_stream", TwitchStreamDto, userID);
        if (cached) return cached;

        const accessToken = await this.getAppAccessToken();
        const response = await this.apiHttp.get<TwitchStreamsResponseDto>("/streams", {
            params: {
                user_id: userID,
                type: "live",
                first: 1,
            },
            headers: this.apiHeaders(accessToken),
            timeout: this.timeout,
        });

        const data = plainToInstance(TwitchStreamsResponseDto, response);
        const stream = data.data?.at(0) ?? null;

        await this.cache.set("twitch_stream", stream, this.streamCacheTtl, userID);
        return stream;
    }

    //#endregion

    private async getAppAccessToken(): Promise<string> {
        if (this.appAccessToken && Date.now() < this.appAccessTokenExpiresAt) {
            return this.appAccessToken;
        }

        if (this.pendingAccessToken) {
            return await this.pendingAccessToken;
        }

        const request = this.fetchAppAccessToken();
        this.pendingAccessToken = request;

        try {
            return await request;
        } finally {
            this.pendingAccessToken = null;
        }
    }

    private async fetchAppAccessToken(): Promise<string> {
        const body = new URLSearchParams({
            client_id: this.config.twitch.client_id,
            client_secret: this.config.twitch.client_secret,
            grant_type: "client_credentials",
        });

        const response = await this.authHttp.post<TwitchTokenDto>("/token", body.toString(), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout: this.authTimeout,
        });

        const token = plainToInstance(TwitchTokenDto, response);
        if (!token.accessToken || !Number.isFinite(token.expiresIn)) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned an invalid app access token.`);
        }

        this.appAccessToken = token.accessToken;
        this.appAccessTokenExpiresAt = Date.now() + Math.max(token.expiresIn * 1_000 - this.tokenExpiryLeeway, 0);

        return token.accessToken;
    }

    private apiHeaders(accessToken: string): Record<string, string> {
        return {
            Authorization: `Bearer ${accessToken}`,
            "Client-Id": this.config.twitch.client_id,
        };
    }
}
