import { TLogger } from "@/core";
import { AbstractService } from "@/core/framework/AbstractService";
import { HttpClient, IHttpClientOptions } from "@/http";

export class HttpService extends AbstractService {
    public create(logger: TLogger, options: IHttpClientOptions): HttpClient {
        const userAgent = `${this.config.app.name}/${this.config.app.version} (+${this.config.app.domain})`;

        return new HttpClient(logger, {
            ...options,
            headers: {
                "User-Agent": userAgent,
                ...options.headers,
            },
        });
    }
}
