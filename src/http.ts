import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { TLogger } from "./core/types";
import { EApplicationError, Exception } from "@domain/core/Exception";

export interface IHttpClientOptions extends AxiosRequestConfig {
    name?: string;
}

interface IExtendedRequestConfig extends InternalAxiosRequestConfig {
    metadata?: {
        startedAt: number;
    };
}

export class HttpClient {
    private readonly client: AxiosInstance;
    private readonly logger: TLogger;

    constructor(logger: TLogger, options: IHttpClientOptions) {
        this.logger = logger.child({ name: `HttpClient:${options.name || "Default"}` });
        this.client = axios.create(options);
        this.setupInterceptors();
    }

    private setupInterceptors(): void {
        this.client.interceptors.request.use((config) => {
            const timedConfig = config as IExtendedRequestConfig;

            timedConfig.metadata = {
                startedAt: Date.now(),
            };

            this.logger.debug(`[${config.method?.toUpperCase()}] ${config.baseURL || ""}${config.url}`);
            return config;
        });

        this.client.interceptors.response.use(
            (response: AxiosResponse) => {
                const durationMs = this.getDuration(response.config);

                this.logger.debug(
                    {
                        method: response.config.method?.toUpperCase(),
                        url: response.config.url,
                        status: response.status,
                        durationMs,
                    },
                    `HTTP request completed in ${durationMs}ms`,
                );

                return response;
            },
            (error: AxiosError) => {
                const status = error.response?.status;
                const url = error.config?.url;

                const data = { message: error.message, status: error.response?.status };
                this.logger.error(data, `HTTP Error ${status} on ${url}`);

                throw new Exception(
                    EApplicationError.INTERNAL_ERROR,
                    `Failed to fetch data from external service. (Status: ${status})`,
                );
            },
        );
    }

    private getDuration(config?: InternalAxiosRequestConfig): number | undefined {
        const startedAt = (config as IExtendedRequestConfig | undefined)?.metadata?.startedAt;
        return startedAt === undefined ? undefined : Date.now() - startedAt;
    }

    public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
        const response = await this.client.get<T>(url, config);
        return response.data;
    }

    public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
        const response = await this.client.post<T>(url, data, config);
        return response.data;
    }

    public async getResponse<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.client.get<T>(url, config);
    }

    public async postResponse<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.client.post<T>(url, data, config);
    }
}
