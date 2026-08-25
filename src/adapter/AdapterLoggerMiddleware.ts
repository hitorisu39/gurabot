import { TLogger } from "@/core";
import { AdapterErrorContext, AdapterHook, AdapterRequestError } from "@generated/adapter/types";

export class AdapterLoggerMiddleware implements AdapterHook {
    constructor(private readonly logger: TLogger) {}

    public onError(context: AdapterErrorContext): void {
        if (context.error instanceof AdapterRequestError && context.error.status === 404) {
            return;
        }

        const message =
            `Adapter provider "${context.providerName}" failed ` +
            `endpoint "${context.endpointName}". ` +
            `Attempt ${context.attempt}/${context.maxAttempts}. ` +
            `Retry: ${context.willRetry}.`;

        if (context.willRetry) {
            this.logger.warn(context.error, message);
            return;
        }

        this.logger.error(context.error, message);
    }
}
