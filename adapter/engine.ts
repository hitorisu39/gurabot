import http from "http";
import https from "https";
import axios, { AxiosRequestConfig, AxiosResponse, isAxiosError } from "axios";
import { ProviderConfig, SchemaModel } from "./builder";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { wait } from "@domain/utils";
import { ModUtils } from "@generated/adapter/mods";
import { Metrics } from "@/metrics";

export interface AdapterHook {
    beforeRequest?: (req: AxiosRequestConfig, args: any) => Promise<AxiosRequestConfig> | AxiosRequestConfig;
    afterRequest?: (res: any) => Promise<any> | any;
}

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

export class AdapterEngine {
    private hooks: Array<AdapterHook> = [];

    private static readonly nonRetryableStatusCodes = new Set([400, 401, 403, 404, 422]);
    private static readonly statusCodeMessages: Record<number, string> = {
        404: "Not Found. This might be due to an incorrect username, ID, etc.",
    };

    constructor(
        public config: ProviderConfig,
        private metrics?: Metrics,
    ) {}

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
        const retryDelay = 250;
        let attempt = 0;

        while (attempt <= maxRetries) {
            const start = performance.now();
            let status = "200";

            try {
                const response: AxiosResponse = await axios.request(requestConfig);

                if (this.metrics) {
                    const durationSec = (performance.now() - start) / 1000;
                    this.metrics.httpRequestHistogram.labels(endpointName, status).observe(durationSec);
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
                    if (!Array.isArray(targetData)) return [];
                    const result = targetData.map((item, idx) =>
                        this.mapData(item, returnsModel, endpoint.mapping, idx),
                    );
                    return result;
                }

                if (!targetData) return null;
                const result = this.mapData(data, returnsModel, endpoint.mapping);
                return result;
            } catch (error: any) {
                status = error.response?.status?.toString() || error.code || "network_error";

                if (this.metrics) {
                    const durationSec = (performance.now() - start) / 1000;
                    this.metrics.httpRequestHistogram.labels(endpointName, status).observe(durationSec);
                }

                if (isAxiosError(error) && error.response) {
                    const status = error.response.status;

                    if (AdapterEngine.nonRetryableStatusCodes.has(status)) {
                        const message =
                            AdapterEngine.statusCodeMessages[status] ||
                            "An unknown error happened in the bot's network.";

                        if (status !== 404)
                            console.error(
                                `[AdapterEngine] Unrecoverable error for endpoint "${endpointName}". Status: ${status}. Message: ${message}`,
                            );

                        throw new Exception(EApplicationError.QUERY_ERROR, message);
                    }
                }

                attempt++;

                console.log(
                    `[AdapterEngine] Request failed for endpoint "${endpointName}" (Attempt ${attempt}/${maxRetries + 1}). ` +
                        `Error: ${error?.message || "Unknown Error"}`,
                );

                if (attempt > maxRetries) {
                    break;
                }

                await wait(retryDelay);
            }
        }
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

    private getByPath(obj: any, path: string) {
        return path
            .split(/[\.\[\]]/)
            .filter(Boolean)
            .reduce((acc, part) => acc && acc[part], obj);
    }
}
