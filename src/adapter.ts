import { AdapterClient } from "@generated/adapter/index";
import { OsuAuthMiddleware } from "./adapter/OsuAuthMiddleware";
import { TLogger } from "./core";
import { TConfig } from "./env";
import { Metrics } from "./metrics";
import { EApplicationError, Exception } from "@domain/core/Exception";

export class ExtendedAdapterClient {
    private adapter: AdapterClient | null;

    constructor(config: TConfig, logger: TLogger, metrics?: Metrics) {
        this.adapter = new AdapterClient(metrics);

        /**
         * osu! Auth Middleware.
         */
        const osuAuthMiddleware = new OsuAuthMiddleware(config, logger);
        this.adapter.osu.$use({ beforeRequest: osuAuthMiddleware.onBeforeRequest.bind(osuAuthMiddleware) });
    }

    /**
     * Flush the instance after we set up all the necessary middleware.
     */
    public flush(): AdapterClient {
        if (!this.adapter)
            throw new Exception(EApplicationError.INTERNAL_ERROR, "The adapter instance was already flushed.");

        const extended = this.adapter;
        this.adapter = null;

        return extended;
    }
}
