import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { TLogger, TMetrics } from "./core/types";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { TExternalRequestOutcome } from "./metrics";

interface IHttpMonitoringOptions {
    metrics: TMetrics;
    service: string;
}

export interface IHttpClientOptions extends AxiosRequestConfig {
    name?: string;
    monitoring?: IHttpMonitoringOptions;
}

export interface IHttpRequestConfig extends AxiosRequestConfig {
    /**
     * Optional override for the Prometheus endpoint label.
     */
    metricsEndpoint?: string;
}

interface IExtendedRequestConfig extends InternalAxiosRequestConfig {
    metricsEndpoint?: string;
    metadata?: {
        startedAt: number;
        metricsEndpoint: string;
        monitored: boolean;
    };
}

export class HttpClient {
    private readonly client: AxiosInstance;
    private readonly logger: TLogger;
    private readonly monitoring?: IHttpMonitoringOptions;

    constructor(logger: TLogger, options: IHttpClientOptions) {
        const { name, monitoring, ...axiosOptions } = options;

        this.logger = logger.child({
            name: `HttpClient:${name || "Default"}`,
        });

        this.monitoring = monitoring;
        this.client = axios.create(axiosOptions);
        this.setupInterceptors();
    }

    private setupInterceptors(): void {
        this.client.interceptors.request.use((config) => {
            const timedConfig = config as IExtendedRequestConfig;
            const metricsEndpoint = timedConfig.metricsEndpoint ?? config.url ?? "unknown";

            timedConfig.metadata = {
                startedAt: performance.now(),
                metricsEndpoint,
                monitored: false,
            };

            if (this.monitoring && metricsEndpoint !== "unknown") {
                const labels = {
                    service: this.monitoring.service,
                    endpoint: metricsEndpoint,
                };

                this.monitoring.metrics.externalRequestsInFlight.inc(labels);
                timedConfig.metadata.monitored = true;
            }

            this.logger.debug(`[${config.method?.toUpperCase()}] ${config.baseURL || ""}${config.url}`);

            return config;
        });

        this.client.interceptors.response.use(
            (response: AxiosResponse) => {
                const status: TExternalRequestOutcome = this.monitoring
                    ? this.monitoring.metrics.classifyHttpStatus(response.status)
                    : "unknown_error";

                const durationMs = this.completeRequest(response.config, status, response.status);

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
                const durationMs = this.completeRequest(error.config, this.classifyError(error), status);

                const data = {
                    message: error.message,
                    status,
                    code: error.code,
                    durationMs,
                };

                this.logger.error(data, `HTTP Error ${status ?? error.code ?? "unknown"} on ${error.config?.url}`);

                throw new Exception(
                    EApplicationError.INTERNAL_ERROR,
                    `Failed to fetch data from external service. (Status: ${status ?? "none"})`,
                );
            },
        );
    }

    private completeRequest(
        config: InternalAxiosRequestConfig | undefined,
        outcome: TExternalRequestOutcome,
        status?: number,
    ): number | undefined {
        const timedConfig = config as IExtendedRequestConfig | undefined;
        const metadata = timedConfig?.metadata;

        if (!metadata) {
            return undefined;
        }

        const durationMs = performance.now() - metadata.startedAt;

        if (this.monitoring && metadata.monitored) {
            const labels = {
                service: this.monitoring.service,
                endpoint: metadata.metricsEndpoint,
            };

            try {
                this.monitoring.metrics.externalRequests.inc({
                    ...labels,
                    outcome,
                    status_code: status?.toString() ?? "none",
                });

                this.monitoring.metrics.externalRequestDuration.observe(labels, durationMs / 1000);
            } finally {
                this.monitoring.metrics.externalRequestsInFlight.dec(labels);
                metadata.monitored = false;
            }
        }

        return durationMs;
    }

    private classifyError(error: AxiosError): TExternalRequestOutcome {
        const status = error.response?.status;

        if (status !== undefined && this.monitoring) {
            return this.monitoring.metrics.classifyHttpStatus(status);
        }

        if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
            return "timeout";
        }

        if (error.code === "ERR_CANCELED" || axios.isCancel(error)) {
            return "cancelled";
        }

        if (error.request) {
            return "network_error";
        }

        return "unknown_error";
    }

    public async get<T>(url: string, config?: IHttpRequestConfig): Promise<T> {
        const response = await this.client.get<T>(url, config);
        return response.data;
    }

    public async post<T>(url: string, data?: unknown, config?: IHttpRequestConfig): Promise<T> {
        const response = await this.client.post<T>(url, data, config);
        return response.data;
    }

    public async getResponse<T>(url: string, config?: IHttpRequestConfig): Promise<AxiosResponse<T>> {
        return this.client.get<T>(url, config);
    }

    public async postResponse<T>(url: string, data?: unknown, config?: IHttpRequestConfig): Promise<AxiosResponse<T>> {
        return this.client.post<T>(url, data, config);
    }
}
