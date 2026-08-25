import { Metrics } from "@/metrics";
import {
    AdapterErrorContext,
    AdapterHook,
    AdapterRequestError,
    AdapterResponseContext,
} from "@generated/adapter/types";

export class AdapterMetricsMiddleware implements AdapterHook {
    constructor(private readonly metrics: Metrics) {}

    public onResponse(context: AdapterResponseContext): void {
        if (!context.response) return;
        this.observe(context.endpointName, context.response.status.toString(), context.durationMs);
    }

    public onError(context: AdapterErrorContext): void {
        const error = context.error;
        const status =
            error instanceof AdapterRequestError ? (error.status?.toString() ?? error.code ?? error.kind) : error.kind;

        this.observe(context.endpointName, status, context.durationMs);
    }

    private observe(endpointName: string, status: string, durationMs: number): void {
        this.metrics.httpRequestHistogram.labels(endpointName, status).observe(durationMs / 1000);
    }
}
