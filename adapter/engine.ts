import http from "http";
import https from "https";
import axios, { AxiosRequestConfig, AxiosResponse, isAxiosError } from "axios";
import { ProviderConfig, SchemaModel } from "./builder";
import { wait } from "./utils";
import { ModUtils } from "@generated/adapter/mods";
import { AdapterErrorKind, AdapterRequestError } from "./error";

export interface AdapterResponseContext {
    providerName: string;
    endpointName: string;
    args: unknown;
    request: AxiosRequestConfig;
    response: AxiosResponse | null;
    attempt: number;
    maxAttempts: number;
    durationMs: number;
}

export interface AdapterErrorContext {
    providerName: string;
    endpointName: string;
    args: unknown;
    request: AxiosRequestConfig;
    error: AdapterRequestError;
    attempt: number;
    maxAttempts: number;
    durationMs: number;
    willRetry: boolean;
}

export interface AdapterHook {
    beforeRequest?: (req: AxiosRequestConfig, args: any) => Promise<AxiosRequestConfig> | AxiosRequestConfig;
    afterRequest?: (res: any) => Promise<any> | any;
    onResponse?: (context: AdapterResponseContext) => Promise<void> | void;
    onError?: (context: AdapterErrorContext) => Promise<void> | void;
}

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

export class AdapterEngine {
    private hooks: Array<AdapterHook> = [];

    private static readonly nonRetryableStatusCodes = new Set([400, 401, 403, 404, 422]);
    private static readonly statusCodeMessages: Record<number, string> = {
        404: "Not Found. This might be due to an incorrect username, ID, etc.",
    };

    constructor(public config: ProviderConfig) {}

    public addHook(hook: AdapterHook): void {
        this.hooks.push(hook);
    }

    public async execute(endpointName: string, args: any) {
        const endpoint = this.config.endpoints[endpointName];
        if (!endpoint)
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "An unknown endpoint was passed to the adapter engine",
            );

        const mappedArgs = { ...args };
        if (endpoint.args) {
            for (const [argName, fieldDef] of Object.entries(endpoint.args)) {
                if (mappedArgs[argName] !== undefined) {
                    let toPlainFn = undefined;

                    const mapConfig = endpoint.mapping[argName];
                    if (
                        mapConfig &&
                        typeof mapConfig === "object" &&
                        mapConfig.transform &&
                        typeof mapConfig.transform === "object"
                    ) {
                        toPlainFn = mapConfig.transform.toPlain;
                    } else if (fieldDef.$type === "Enum" && fieldDef.$enumDef && this.config.transforms) {
                        toPlainFn = this.config.transforms[fieldDef.$enumDef.$name]?.toPlain;
                    }

                    if (toPlainFn) {
                        mappedArgs[argName] = toPlainFn(mappedArgs[argName]);
                    }
                }
            }
        }

        let requestConfig: AxiosRequestConfig = {
            url: endpoint.path(mappedArgs),
            baseURL: this.config.base,
            method: endpoint.method,
            headers: { "Content-Type": "application/json" },
            httpAgent: httpAgent,
            httpsAgent: httpsAgent,
        };

        for (const hook of this.hooks) {
            if (hook.beforeRequest) {
                requestConfig = await hook.beforeRequest(requestConfig, mappedArgs);
            }
        }

        const maxRetries = 2;
        const maxAttempts = maxRetries + 1;
        const retryDelay = 250;

        let response: AxiosResponse | null = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const start = performance.now();

            try {
                response = await axios.request(requestConfig);

                await this.notifyResponseHooks({
                    providerName: this.config.name,
                    endpointName,
                    args: mappedArgs,
                    request: requestConfig,
                    response,
                    attempt,
                    maxAttempts,
                    durationMs: performance.now() - start,
                });

                break;
            } catch (error: unknown) {
                const retryable = this.isRetryable(error);
                const willRetry = retryable && attempt < maxAttempts;

                const requestError = this.createRequestError(endpointName, error, attempt, maxAttempts, retryable);

                await this.notifyErrorHooks({
                    providerName: this.config.name,
                    endpointName,
                    args: mappedArgs,
                    request: requestConfig,
                    error: requestError,
                    attempt,
                    maxAttempts,
                    durationMs: performance.now() - start,
                    willRetry,
                });

                if (!willRetry) {
                    throw requestError;
                }

                await wait(retryDelay);
            }
        }

        if (!response) {
            throw new AdapterRequestError(`Adapter endpoint "${endpointName}" exited without a response.`, {
                providerName: this.config.name,
                endpointName,
                kind: "internal",
                retryable: false,
                attempt: maxAttempts,
                maxAttempts,
            });
        }

        let data = response.data;

        for (const hook of this.hooks) {
            if (hook.afterRequest) {
                data = await hook.afterRequest(data);
            }
        }

        const returnsModel = "model" in endpoint.returns ? endpoint.returns.model : endpoint.returns;

        const isArray = "isArray" in endpoint.returns ? endpoint.returns.isArray : false;

        const dataPath = "dataPath" in endpoint.returns ? endpoint.returns.dataPath : undefined;

        const targetData = dataPath ? this.getByPath(data, dataPath) : data;

        if (isArray) {
            if (!Array.isArray(targetData)) {
                return [];
            }

            return targetData.map((item, index) => this.mapData(item, returnsModel, endpoint.mapping, index));
        }

        if (!targetData) {
            return null;
        }

        return this.mapData(targetData, returnsModel, endpoint.mapping);
    }

    private mapData(raw: any, model: SchemaModel, mapping: Record<string, any>, arrayIndex?: number) {
        const result: any = {};
        for (const [fieldName, fieldDef] of Object.entries(model.fields)) {
            const mapConfig = mapping[fieldName];
            let value = undefined;

            if (mapConfig === "$index") {
                value = arrayIndex !== undefined ? arrayIndex + 1 : 1;
            } else if (mapConfig) {
                if (typeof mapConfig === "string") {
                    value = this.getByPath(raw, mapConfig);
                } else {
                    value = this.getByPath(raw, mapConfig.path || fieldName);
                    if (value === undefined && mapConfig.default !== undefined) value = mapConfig.default;
                }

                if (value !== undefined) {
                    let toInstanceFn = undefined;

                    if (typeof mapConfig === "object" && mapConfig.transform) {
                        toInstanceFn =
                            typeof mapConfig.transform === "function"
                                ? mapConfig.transform
                                : mapConfig.transform.toInstance;
                    } else if (fieldDef.$type === "Enum" && fieldDef.$enumDef && this.config.transforms) {
                        toInstanceFn = this.config.transforms[fieldDef.$enumDef.$name]?.toInstance;
                    }

                    if (toInstanceFn) {
                        value = toInstanceFn(value);
                    }
                }
            } else {
                value = this.getByPath(raw, fieldName);

                if (
                    value !== undefined &&
                    value !== null &&
                    fieldDef.$type === "Enum" &&
                    fieldDef.$enumDef &&
                    this.config.transforms
                ) {
                    const toInstanceFn = this.config.transforms[fieldDef.$enumDef.$name]?.toInstance;
                    if (toInstanceFn) value = toInstanceFn(value);
                }
            }

            if (fieldDef.$type === "Mods" && value !== undefined && value !== null) {
                value = ModUtils.parse(value);
            }

            if (fieldDef.$type === "Date" && value !== undefined && value !== null) {
                value = new Date(value);
            }

            if (fieldDef.$type === "Model" && fieldDef.$nestedModel && value) {
                const nestedMapping = typeof mapConfig === "object" && mapConfig.nested ? mapConfig.nested : {};

                if (fieldDef.$isArray) {
                    value = (value as any[]).map((v, idx) =>
                        this.mapData(v, fieldDef.$nestedModel!, nestedMapping, idx),
                    );
                } else {
                    value = this.mapData(value, fieldDef.$nestedModel, nestedMapping);
                }
            }

            result[fieldName] = value;
        }

        return result;
    }

    private isRetryable(error: unknown): boolean {
        if (!isAxiosError(error)) {
            return false;
        }

        if (error.code === "ERR_CANCELED") {
            return false;
        }

        if (!error.response) {
            return true;
        }

        return !AdapterEngine.nonRetryableStatusCodes.has(error.response.status);
    }

    private createRequestError(
        endpointName: string,
        error: unknown,
        attempt: number,
        maxAttempts: number,
        retryable: boolean,
    ): AdapterRequestError {
        let kind: AdapterErrorKind = "internal";
        let status: number | undefined;
        let code: string | undefined;

        if (isAxiosError(error)) {
            status = error.response?.status;
            code = error.code;

            if (error.code === "ERR_CANCELED") {
                kind = "cancelled";
            } else if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
                kind = "timeout";
            } else if (error.response) {
                kind = "http";
            } else {
                kind = "network";
            }
        }

        const message = this.createRequestErrorMessage(endpointName, kind, status, code);

        return new AdapterRequestError(message, {
            providerName: this.config.name,
            endpointName,
            kind,
            retryable,
            attempt,
            maxAttempts,
            status,
            code,
            originalError: error,
        });
    }

    private createRequestErrorMessage(
        endpointName: string,
        kind: AdapterErrorKind,
        status?: number,
        code?: string,
    ): string {
        if (kind === "http") {
            return `Adapter endpoint "${endpointName}" returned ` + `HTTP status ${status}.`;
        }

        if (kind === "timeout") {
            return `Adapter endpoint "${endpointName}" timed out.`;
        }

        if (kind === "cancelled") {
            return `Adapter endpoint "${endpointName}" was cancelled.`;
        }

        if (kind === "network") {
            const suffix = code ? ` Error code: ${code}.` : "";

            return `Adapter endpoint "${endpointName}" could not be reached.` + suffix;
        }

        return `Adapter endpoint "${endpointName}" failed with an ` + `unexpected internal error.`;
    }

    private async notifyResponseHooks(context: AdapterResponseContext): Promise<void> {
        await Promise.allSettled(
            this.hooks.map(async (hook) => {
                await hook.onResponse?.(context);
            }),
        );
    }

    private async notifyErrorHooks(context: AdapterErrorContext): Promise<void> {
        await Promise.allSettled(
            this.hooks.map(async (hook) => {
                await hook.onError?.(context);
            }),
        );
    }

    private getByPath(obj: any, path: string) {
        return path
            .split(/[\.\[\]]/)
            .filter(Boolean)
            .reduce((acc, part) => acc && acc[part], obj);
    }
}
