import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ICacheSchema } from "@domain/core/Cache";

import { AbstractPaginationComponent, IPaginationViewData, TPaginationCacheKey } from "./AbstractPaginationComponent";

export abstract class AbstractPaginationModal<
    K extends TPaginationCacheKey,
    T extends ICacheSchema[K] & IPaginationViewData,
> extends AbstractPaginationComponent<K, T> {
    protected getModalInputID(): string {
        return "page_number";
    }

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;

        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = await this.getData(ctx, sessionID);

        const input = ctx.getTextInput(this.getModalInputID());
        if (!input) {
            throw new Exception(EApplicationError.INPUT_ERROR);
        }

        const newPage = parseInt(input, 10);
        const currentPage = this.getCurrentPage(data);
        const totalPages = this.getTotalPages(data);

        await ctx.deferUpdate();

        if (Number.isNaN(newPage) || newPage < 1 || newPage > totalPages || newPage === currentPage) {
            return;
        }

        await this.updatePage(ctx, sessionID, data, newPage);
    }
}
