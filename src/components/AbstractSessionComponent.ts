import { TConstructor, TObjectKeys } from "@/core";
import { AbstractComponent } from "@/core/discord/AbstractComponent";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { ICacheSchema } from "@domain/core/Cache";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { plainToInstance } from "class-transformer";

export interface ISessionViewData {
    authorID: string;
}

export type TSessionCacheKey = {
    [K in TObjectKeys<ICacheSchema>]: ICacheSchema[K] extends ISessionViewData ? K : never;
}[TObjectKeys<ICacheSchema>];

export abstract class AbstractSessionComponent<
    K extends TSessionCacheKey,
    T extends ICacheSchema[K] & ISessionViewData,
> extends AbstractComponent {
    protected abstract readonly sessionKey: K;
    protected abstract readonly dto: TConstructor<T>;

    protected async getData(ctx: ComponentContext, sessionID: string): Promise<T> {
        const plain = await this.session.get(this.sessionKey, sessionID);
        if (!plain) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = plainToInstance(this.dto, plain);
        if (data.authorID !== ctx.author.id) {
            throw new Exception(EApplicationError.ACCESS_ERROR);
        }

        return data;
    }
}
