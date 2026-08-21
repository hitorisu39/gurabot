import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { Pagination } from "@domain/discord/utils/Pagination";
import { ICacheSchema } from "@domain/core/Cache";
import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { AbstractPaginationComponent, IPaginationViewData, TPaginationCacheKey } from "./AbstractPaginationComponent";

export abstract class AbstractPaginationButton<
    K extends TPaginationCacheKey,
    T extends ICacheSchema[K] & IPaginationViewData,
> extends AbstractPaginationComponent<K, T> {
    protected abstract readonly paginationID: string;

    protected getModalTitle(_data: T): string {
        return "Jump to Page";
    }

    protected getModalLabel(_data: T, _totalPages: number): string {
        return "Page number";
    }

    protected getModalInputID(): string {
        return "page_number";
    }

    public async execute(ctx: ComponentContext): Promise<void> {
        const { action, sessionID } = ctx.params;

        if (!sessionID || !action) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = await this.getData(ctx, sessionID);
        const currentPage = this.getCurrentPage(data);
        const totalPages = this.getTotalPages(data);

        if (action === "modal") {
            const modal = new ModalBuilder()
                .setCustomId(`${this.paginationID}_modal:${sessionID}`)
                .setTitle(this.getModalTitle(data));

            const pageInput = new TextInputBuilder()
                .setCustomId(this.getModalInputID())
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(totalPages.toString().length);

            const pageLabel = new LabelBuilder()
                .setLabel(this.getModalLabel(data, totalPages))
                .setTextInputComponent(pageInput);

            modal.addLabelComponents(pageLabel);

            await ctx.showModal(modal);
            return;
        }

        const newPage = this.calculateNewPage(action, data, totalPages);
        await ctx.deferUpdate();

        if (newPage === currentPage) {
            return;
        }

        await this.updatePage(ctx, sessionID, data, newPage);
    }

    protected calculateNewPage(action: string, data: T, totalPages: number): number {
        return Pagination.calculateNewPage(action, this.getCurrentPage(data), totalPages);
    }
}
