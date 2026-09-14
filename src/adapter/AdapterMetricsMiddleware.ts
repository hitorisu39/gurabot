import { TMetrics } from "@/core";
import { TExternalRequestOutcome } from "@/metrics";
import {
    AdapterErrorContext,
    AdapterHook,
    AdapterRequestError,
    AdapterResponseContext,
} from "@generated/adapter/types";

export class AdapterMetricsMiddleware implements AdapterHook {
    constructor(private readonly metrics: TMetrics) {}

    public onResponse(context: AdapterResponseContext): void {
        const status = context.response.status;

        this.observe(
            context.providerName,
            context.endpointName,
            this.metrics.classifyHttpStatus(status),
            status,
            context.durationMs,
        );
    }

    public onError(context: AdapterErrorContext): void {
        const error = context.error;

        if (error instanceof AdapterRequestError) {
            const status = error.status;
            const outcome =
                status !== undefined ? this.metrics.classifyHttpStatus(status) : this.classifyRequestError(error);
            this.observe(context.providerName, context.endpointName, outcome, status, context.durationMs);
            return;
        }

        this.observe(context.providerName, context.endpointName, "unknown_error", error.status, context.durationMs);
    }

    private observe(
        provider: string,
        endpoint: string,
        outcome: TExternalRequestOutcome,
        statusCode: number | undefined,
        durationMs: number,
    ): void {
        this.metrics.adapterApiRequests.inc({
            provider,
            endpoint,
            outcome,
            status_code: statusCode?.toString() ?? "none",
        });

        this.metrics.adapterApiRequestDuration.observe(
            {
                provider,
                endpoint,
            },
            durationMs / 1000,
        );
    }

    private classifyRequestError(error: AdapterRequestError): TExternalRequestOutcome {
        switch (error.kind) {
            case "timeout":
                return "timeout";
            case "cancelled":
                return "cancelled";
            case "network":
                return "network_error";
            default:
                return "unknown_error";
        }
    }
}
