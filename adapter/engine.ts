import http from "http";
import https from "https";

import axios, { AxiosRequestConfig, AxiosResponse, isAxiosError } from "axios";
import { ProviderConfig, SchemaModel, EndpointConfig } from "./builder";

import {
    AdapterConfigurationError,
    AdapterError,
    AdapterRequestError,
    AdapterRequestErrorKind,
    AdapterResponseError,
} from "./error";

import { wait } from "./utils";

export interface AdapterResponseContext {
    providerName: string;
    endpointName: string;
    args: unknown;
    request: AxiosRequestConfig;
    response: AxiosResponse;
    attempt: number;
    maxAttempts: number;
    durationMs: number;
}

export interface AdapterErrorContext {
    providerName: string;
    endpointName: string;
    args: unknown;
    request: AxiosRequestConfig;
    error: AdapterRequestError | AdapterResponseError;
    attempt: number;
    maxAttempts: number;
    durationMs: number;
    willRetry: boolean;
}

export interface AdapterFieldCodec {
    toPlain(value: unknown): unknown;
    toInstance(value: unknown): unknown;
}

export interface AdapterFieldCodecs {
    Mods: AdapterFieldCodec;
}

export interface AdapterHook {
    beforeRequest?: (request: AxiosRequestConfig, args: unknown) => Promise<AxiosRequestConfig> | AxiosRequestConfig;
    afterRequest?: (data: unknown) => Promise<unknown> | unknown;
    onResponse?: (context: AdapterResponseContext) => Promise<void> | void;
    onError?: (context: AdapterErrorContext) => Promise<void> | void;
    mapError?: (error: Error, context: AdapterErrorContext) => Promise<Error> | Error;
}

const httpAgent = new http.Agent({
    keepAlive: true,
});

const httpsAgent = new https.Agent({
    keepAlive: true,
});

export class AdapterEngine {
    private readonly hooks: Array<AdapterHook> = [];
    private static readonly nonRetryableStatusCodes = new Set([400, 401, 403, 404, 422]);

    constructor(
        public readonly config: ProviderConfig,
        private readonly codecs: AdapterFieldCodecs,
    ) {}

    public addHook(hook: AdapterHook): void {
        this.hooks.push(hook);
    }

    public async execute(endpointName: string, args: any): Promise<any> {
        const endpoint = this.config.endpoints[endpointName];

        if (!endpoint) {
            throw new AdapterConfigurationError(
                `Unknown endpoint "${endpointName}" for adapter provider "${this.config.name}".`,
                {
                    providerName: this.config.name,
                    endpointName,
                },
            );
        }

        const mappedArgs = this.mapArguments(endpoint, args);

        let requestConfig: AxiosRequestConfig = {
            url: endpoint.path(mappedArgs),
            baseURL: this.config.base,
            method: endpoint.method,
            responseType: endpoint.responseType,
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            httpAgent,
            httpsAgent,
        };

        for (const hook of this.hooks) {
            if (hook.beforeRequest) {
                requestConfig = await hook.beforeRequest(requestConfig, mappedArgs);
            }
        }

        const maxRetries = 2;
        const maxAttempts = maxRetries + 1;
        const retryDelayMs = 250;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const start = performance.now();

            try {
                const response = await axios.request(requestConfig);

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

                return await this.processResponse(endpointName, endpoint, mappedArgs, response, attempt, maxAttempts);
            } catch (error: unknown) {
                const normalizedError = this.normalizeError(endpointName, error, attempt, maxAttempts);
                const retryable = this.isRetryable(normalizedError);
                const willRetry = retryable && attempt < maxAttempts;

                const context: AdapterErrorContext = {
                    providerName: this.config.name,
                    endpointName,
                    args: mappedArgs,
                    request: requestConfig,
                    error: normalizedError,
                    attempt,
                    maxAttempts,
                    durationMs: performance.now() - start,
                    willRetry,
                };

                await this.notifyErrorHooks(context);

                if (!willRetry) {
                    throw await this.mapError(normalizedError, context);
                }

                const delay = retryDelayMs * Math.pow(2, attempt - 1);
                await wait(delay);
            }
        }

        throw new AdapterConfigurationError(`Adapter endpoint "${endpointName}" exited without a response or error.`, {
            providerName: this.config.name,
            endpointName,
        });
    }

    private mapArguments(endpoint: EndpointConfig, args: any): Record<string, any> {
        const mappedArgs = {
            ...args,
        };

        if (!endpoint.args) {
            return mappedArgs;
        }

        for (const [argName, fieldDef] of Object.entries(endpoint.args)) {
            if (mappedArgs[argName] === undefined) {
                continue;
            }

            if (fieldDef.$type === "Mods") {
                mappedArgs[argName] = this.codecs.Mods.toPlain(mappedArgs[argName]);

                continue;
            }

            let toPlainFn: ((value: any) => any) | undefined;

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

            if (!toPlainFn) {
                continue;
            }

            const value = mappedArgs[argName];

            mappedArgs[argName] =
                fieldDef.$isArray && Array.isArray(value) ? value.map((item) => toPlainFn!(item)) : toPlainFn(value);
        }

        return mappedArgs;
    }

    private async processResponse(
        endpointName: string,
        endpoint: EndpointConfig,
        mappedArgs: Record<string, any>,
        response: AxiosResponse,
        attempt: number,
        maxAttempts: number,
    ): Promise<any> {
        let data: unknown = response.data;

        for (const hook of this.hooks) {
            if (hook.afterRequest) {
                data = await hook.afterRequest(data);
            }
        }

        if (endpoint.transformResponse) {
            data = await endpoint.transformResponse(data, mappedArgs);
        }

        const endpointReturns = endpoint.returns;

        if ("raw" in endpointReturns) {
            if (data instanceof Uint8Array) {
                return data;
            }

            if (data instanceof ArrayBuffer) {
                return new Uint8Array(data);
            }

            throw new AdapterResponseError(
                `Adapter endpoint "${endpointName}" expected a binary response but received ${this.describeValue(data)}.`,
                {
                    providerName: this.config.name,
                    endpointName,
                    kind: "invalid_shape",
                    retryable: true,
                    attempt,
                    maxAttempts,
                    status: response.status,
                    receivedType: this.describeValue(data),
                },
            );
        }

        const returnsModel = "model" in endpointReturns ? endpointReturns.model : endpointReturns;
        const isArray = "isArray" in endpointReturns ? (endpointReturns.isArray ?? false) : false;
        const dataPath = "dataPath" in endpointReturns ? endpointReturns.dataPath : undefined;

        const targetData = dataPath ? this.getByPath(data, dataPath) : data;

        if (isArray) {
            if (!Array.isArray(targetData)) {
                throw new AdapterResponseError(
                    `Adapter endpoint "${endpointName}" expected an array response` +
                        (dataPath ? ` at "${dataPath}"` : "") +
                        ` but received ${this.describeValue(targetData)}.`,
                    {
                        providerName: this.config.name,
                        endpointName,
                        kind: "invalid_shape",
                        retryable: true,
                        attempt,
                        maxAttempts,
                        status: response.status,
                        receivedType: this.describeValue(targetData),
                    },
                );
            }

            return targetData.map((item, index) => this.mapData(item, returnsModel, endpoint.mapping, index));
        }

        if (targetData === undefined || targetData === null) {
            return null;
        }

        return this.mapData(targetData, returnsModel, endpoint.mapping);
    }

    private normalizeError(
        endpointName: string,
        error: unknown,
        attempt: number,
        maxAttempts: number,
    ): AdapterRequestError | AdapterResponseError {
        if (error instanceof AdapterRequestError || error instanceof AdapterResponseError) {
            return error;
        }

        const retryable = this.isRetryableRequestFailure(error);
        return this.createRequestError(endpointName, error, attempt, maxAttempts, retryable);
    }

    private isRetryable(error: AdapterError): boolean {
        if (error instanceof AdapterRequestError) {
            return error.retryable;
        }

        if (error instanceof AdapterResponseError) {
            return error.retryable;
        }

        /*
         * Configuration errors and unknown AdapterError
         * subclasses are not retryable by default.
         */
        return false;
    }

    private isRetryableRequestFailure(error: unknown): boolean {
        if (!isAxiosError(error)) {
            return false;
        }

        /*
         * Explicit cancellation shouldn't be retried.
         */
        if (error.code === "ERR_CANCELED") {
            return false;
        }

        /*
         * Axios error without an HTTP response:
         * ECONNRESET, DNS, socket failure, etc.
         */
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
        let kind: AdapterRequestErrorKind = "internal";

        let status: number | undefined;
        let code: string | undefined;

        if (isAxiosError(error)) {
            status = error.response?.status;
            code = error.code;

            if (code === "ERR_CANCELED") {
                kind = "cancelled";
            } else if (code === "ECONNABORTED" || code === "ETIMEDOUT") {
                kind = "timeout";
            } else if (status !== undefined) {
                kind = "http";
            } else {
                kind = "network";
            }
        }

        return new AdapterRequestError(this.createRequestErrorMessage(endpointName, kind, status, code), {
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
        kind: AdapterRequestErrorKind,
        status?: number,
        code?: string,
    ): string {
        switch (kind) {
            case "http":
                return `Adapter endpoint "${endpointName}" returned ` + `HTTP status ${status}.`;
            case "timeout":
                return `Adapter endpoint "${endpointName}" timed out.`;
            case "cancelled":
                return `Adapter endpoint "${endpointName}" was cancelled.`;
            case "network":
                return code
                    ? `Adapter endpoint "${endpointName}" could not be reached. ` + `Error code: ${code}.`
                    : `Adapter endpoint "${endpointName}" could not be reached.`;
            case "internal":
                return `Adapter endpoint "${endpointName}" failed with an ` + `unexpected internal error.`;
        }
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

    private async mapError(error: Error, context: AdapterErrorContext): Promise<Error> {
        let mappedError = error;

        for (const hook of this.hooks) {
            if (hook.mapError) {
                mappedError = await hook.mapError(mappedError, context);
            }
        }

        return mappedError;
    }

    private mapData(raw: any, model: SchemaModel, mapping: Record<string, any>, arrayIndex?: number): any {
        const result: any = {};

        for (const [fieldName, fieldDef] of Object.entries(model.fields)) {
            const mapConfig = mapping[fieldName];

            let value: any;

            if (mapConfig === "$index") {
                value = arrayIndex !== undefined ? arrayIndex + 1 : 1;
            } else if (mapConfig) {
                if (typeof mapConfig === "string") {
                    value = this.getByPath(raw, mapConfig);
                } else {
                    value = this.getByPath(raw, mapConfig.path || fieldName);

                    if (value === undefined && mapConfig.default !== undefined) {
                        value = mapConfig.default;
                    }
                }

                if (value !== undefined) {
                    let toInstanceFn: ((input: any) => any) | undefined;

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

                    if (toInstanceFn) {
                        value = toInstanceFn(value);
                    }
                }
            }

            if (fieldDef.$type === "Mods" && value !== undefined && value !== null) {
                value = this.codecs.Mods.toInstance(value);
            }

            if (fieldDef.$type === "Date" && value !== undefined && value !== null) {
                value = new Date(value);
            }

            if (fieldDef.$type === "Model" && fieldDef.$nestedModel && value) {
                const nestedMapping = typeof mapConfig === "object" && mapConfig.nested ? mapConfig.nested : {};

                if (fieldDef.$isArray) {
                    value = (value as any[]).map((item, index) =>
                        this.mapData(item, fieldDef.$nestedModel!, nestedMapping, index),
                    );
                } else {
                    value = this.mapData(value, fieldDef.$nestedModel, nestedMapping);
                }
            }

            result[fieldName] = value;
        }

        return result;
    }

    private getByPath(obj: any, path: string): any {
        return path
            .split(/[.\[\]]/)
            .filter(Boolean)
            .reduce((current, part) => (current === undefined || current === null ? undefined : current[part]), obj);
    }

    private describeValue(value: unknown): string {
        if (value === null) {
            return "null";
        }

        if (value === undefined) {
            return "undefined";
        }

        if (Array.isArray(value)) {
            return "array";
        }

        if (value instanceof Uint8Array) {
            return "Uint8Array";
        }

        if (value instanceof ArrayBuffer) {
            return "ArrayBuffer";
        }

        return typeof value;
    }
}
