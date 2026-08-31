import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { ICacheSchema } from "@domain/core/Cache";
import { AbstractSessionComponent, ISessionViewData, TSessionCacheKey } from "./AbstractSessionComponent";

export interface IPaginationViewData extends ISessionViewData {}

export type TPaginationCacheKey = TSessionCacheKey;

export abstract class AbstractPaginationComponent<
    K extends TPaginationCacheKey,
    T extends ICacheSchema[K] & IPaginationViewData,
> extends AbstractSessionComponent<K, T> {
    protected abstract get viewService(): AbstractViewService<T, any>;

    protected abstract getCurrentPage(data: T): number;
    protected abstract getTotalPages(data: T): number;
    protected abstract setCurrentPage(data: T, page: number): void | Promise<void>;

    protected async preparePage(_data: T): Promise<void> {
        return;
    }

    protected async updatePage(ctx: ComponentContext, sessionID: string, data: T, page: number): Promise<void> {
        await this.setCurrentPage(data, page);
        await this.preparePage(data);

        await this.session.update(this.sessionKey, sessionID, data, this.viewService.getTtl());

        const payload = await this.viewService.build(sessionID, data);
        await ctx.update(payload);
    }
}
