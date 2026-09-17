import { Import } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { HttpClient } from "@/http";
import { HttpService } from "@/modules/http/Http.service";

import { EApplicationError, Exception } from "@domain/core/Exception";
import { EOtrRuleset } from "@domain/otr/enums/Otr.enum";
import { isValidDate } from "@domain/utils/dateTimeUtils";
import { GameMode } from "@generated/adapter/types";

export abstract class AbstractOtrService extends AbstractService {
    @Import() declare private readonly httpService: HttpService;

    declare protected http: HttpClient;

    protected readonly name = "o!TR";
    protected readonly base = "https://otr.stagec.net/api";

    protected readonly timeout = 5_000;
    protected readonly heavyTimeout = 15_000;

    public init(): void {
        this.http = this.httpService.create(this.logger, {
            name: this.name,
            baseURL: this.base,
            headers: {
                Authorization: `Bearer ${this.config.otr.api_key}`,
            },
            monitoring: {
                service: this.name,
                metrics: this.metrics,
            },
        });
    }

    protected gamemode(mode?: GameMode): EOtrRuleset | undefined {
        if (mode === undefined) return undefined;

        switch (mode) {
            case GameMode.Standard:
                return EOtrRuleset.Standard;
            case GameMode.Taiko:
                return EOtrRuleset.Taiko;
            case GameMode.Catch:
                return EOtrRuleset.Catch;
            case GameMode.Mania:
                return EOtrRuleset.Mania;
        }
    }

    protected date(value?: Date): string | undefined {
        if (!value) return undefined;

        if (!isValidDate(value)) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} received an invalid date`);
        }

        return value.toISOString().slice(0, 10);
    }
}
