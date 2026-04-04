import { TLogger } from "@/core";
import { TConfig } from "@/env";
import { HttpClient } from "@/http";
import { IAuthResponse } from "@domain/auth/Auth.dto";
import { osuBaseUrl } from "@domain/osu/configs/Osu.config";
import { AxiosRequestConfig } from "axios";

/**
 * The class responsible for acquiring/keeping and injecting the
 * osu! authentication token into the adapter requests.
 */
export class OsuAuthMiddleware {
    private readonly clientID: string;
    private readonly clientSecret: string;

    private readonly http: HttpClient;
    private readonly apiVersion = "20240529";

    private token: string | null = null;
    private expiresAt: number = 0;
    private tokenPromise: Promise<string> | null = null;

    constructor(config: TConfig, logger: TLogger) {
        this.http = new HttpClient(logger, { name: "OsuAuthMiddleware", baseURL: osuBaseUrl });
        this.clientID = config.adapter.osu.client_id;
        this.clientSecret = config.adapter.osu.client_secret;
    }

    public async onBeforeRequest(request: AxiosRequestConfig): Promise<AxiosRequestConfig> {
        const token = await this.getToken();

        request.headers = request.headers || {};
        request.headers["Authorization"] = `Bearer ${token}`;
        request.headers["x-api-version"] = this.apiVersion;

        return request;
    }

    private async getToken(): Promise<string> {
        if (this.token && Date.now() < this.expiresAt - 10000) return this.token;

        if (this.tokenPromise) return this.tokenPromise;

        this.tokenPromise = this.acquireNewToken();
        return this.tokenPromise;
    }

    private async acquireNewToken(): Promise<string> {
        try {
            const response = await this.http.post<IAuthResponse>("/oauth/token", {
                client_id: this.clientID,
                client_secret: this.clientSecret,
                grant_type: "client_credentials",
                scope: "public",
            });

            this.token = response.access_token;
            this.expiresAt = Date.now() + response.expires_in * 1000;

            return this.token!;
        } finally {
            this.tokenPromise = null;
        }
    }
}
