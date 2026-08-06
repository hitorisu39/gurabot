import { Button, Import, Modal } from "@/core/decorators";
import { AbstractComponent } from "@/core/discord/AbstractComponent";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { SessionService } from "@/modules/cache/Session.service";
import { NoChokeViewService } from "@/modules/osu/nochoke/NoChokeView.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { Pagination } from "@domain/discord/utils/Pagination";
import { NoChokeViewDto } from "@domain/osu/views/NoChoke.view";
import { plainToInstance } from "class-transformer";
import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

@Button(/^osu_nochoke_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class NoChokePaginationComponent extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly noChokeViewService: NoChokeViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { action, sessionID } = ctx.params;

        if (!sessionID || !action) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = await this.getData(ctx, sessionID);
        const pageSize = this.noChokeViewService.getPageSize();

        const totalPages = Math.ceil(data.scores.length / pageSize) || 1;

        if (action === "modal") {
            const modal = new ModalBuilder().setCustomId(`osu_nochoke_modal:${sessionID}`).setTitle("Jump to Page");

            const pageInput = new TextInputBuilder()
                .setCustomId("page_number")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(totalPages.toString().length);

            const pageLabel = new LabelBuilder().setLabel("Page number").setTextInputComponent(pageInput);

            modal.addLabelComponents(pageLabel);
            await ctx.showModal(modal);
            return;
        }

        const newPage = Pagination.calculateNewPage(action, data.page, totalPages);

        if (newPage === data.page) {
            return;
        }

        await ctx.deferUpdate();

        data.page = newPage;
        await this.noChokeViewService.populatePage(data.scores, data.page, data);
        await this.sessionService.update("osu_nochoke_view", sessionID, data, this.noChokeViewService.getTtl());
        await ctx.update(this.noChokeViewService.build(sessionID, data));
    }

    private async getData(ctx: ComponentContext, sessionID: string): Promise<NoChokeViewDto> {
        const plain = await this.sessionService.get("osu_nochoke_view", sessionID);
        if (!plain) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = plainToInstance(NoChokeViewDto, plain);
        if (data.authorID !== ctx.author.id) {
            throw new Exception(EApplicationError.ACCESS_ERROR);
        }

        return data;
    }
}

@Modal(/^osu_nochoke_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class NoChokePaginationModal extends AbstractComponent {
    @Import()
    declare private readonly sessionService: SessionService;

    @Import()
    declare private readonly noChokeViewService: NoChokeViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;

        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = await this.getData(ctx, sessionID);
        const rawInput = ctx.getTextInput("page_number");

        if (!rawInput) {
            throw new Exception(EApplicationError.INPUT_ERROR, "A page number is required.");
        }

        const pageSize = this.noChokeViewService.getPageSize();
        const totalPages = Math.ceil(data.scores.length / pageSize) || 1;
        const newPage = Number(rawInput);

        if (!Number.isSafeInteger(newPage) || newPage < 1 || newPage > totalPages) {
            throw new Exception(EApplicationError.INPUT_ERROR, `The page number must be between 1 and ${totalPages}.`);
        }

        await ctx.deferUpdate();
        if (newPage === data.page) {
            return;
        }

        data.page = newPage;
        await this.noChokeViewService.populatePage(data.scores, data.page, data);
        await this.sessionService.update("osu_nochoke_view", sessionID, data, this.noChokeViewService.getTtl());
        await ctx.update(this.noChokeViewService.build(sessionID, data));
    }

    private async getData(ctx: ComponentContext, sessionID: string): Promise<NoChokeViewDto> {
        const plain = await this.sessionService.get("osu_nochoke_view", sessionID);
        if (!plain) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = plainToInstance(NoChokeViewDto, plain);
        if (data.authorID !== ctx.author.id) {
            throw new Exception(EApplicationError.ACCESS_ERROR);
        }

        return data;
    }
}
