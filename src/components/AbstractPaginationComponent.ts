import { TConstructor, TObjectKeys } from "@/core";
import { Import } from "@/core/decorators";
import { AbstractComponent } from "@/core/discord/AbstractComponent";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { SessionService } from "@/modules/cache/Session.service";
import { ICacheSchema } from "@domain/core/Cache";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { plainToInstance } from "class-transformer";

export interface IPaginationViewData {
    authorID: string;
}

export type TPaginationCacheKey = {
    [K in TObjectKeys<ICacheSchema>]: ICacheSchema[K] extends IPaginationViewData ? K : never;
}[TObjectKeys<ICacheSchema>];

export abstract class AbstractPaginationComponent<
    K extends TPaginationCacheKey,
    T extends ICacheSchema[K] & IPaginationViewData,
> extends AbstractComponent {
    @Import() declare protected readonly sessionService: SessionService;

    protected abstract readonly sessionKey: K;
    protected abstract readonly dto: TConstructor<T>;
    protected abstract get viewService(): AbstractViewService<T, any>;

    protected abstract getCurrentPage(data: T): number;
    protected abstract getTotalPages(data: T): number;
    protected abstract setCurrentPage(data: T, page: number): void | Promise<void>;

    protected async preparePage(_data: T): Promise<void> {
        return;
    }

    protected async getData(ctx: ComponentContext, sessionID: string): Promise<T> {
        const plain = await this.sessionService.get(this.sessionKey, sessionID);

        if (!plain) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = plainToInstance(this.dto, plain);

        if (data.authorID !== ctx.author.id) {
            throw new Exception(EApplicationError.ACCESS_ERROR);
        }

        return data;
    }

    protected async updatePage(ctx: ComponentContext, sessionID: string, data: T, page: number): Promise<void> {
        await this.setCurrentPage(data, page);
        await this.preparePage(data);

        await this.sessionService.update(this.sessionKey, sessionID, data, this.viewService.getTtl());
        const payload = await this.viewService.build(sessionID, data);
        await ctx.update(payload);
    }
}
