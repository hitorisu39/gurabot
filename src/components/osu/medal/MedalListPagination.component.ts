import { Button, Import, Modal } from "@/core/decorators";
import { AbstractComponent } from "@/core/discord/AbstractComponent";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { SessionService } from "@/modules/cache/Session.service";
import { Pagination } from "@domain/discord/utils/Pagination";
import { plainToInstance } from "class-transformer";
import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { MedalListViewService } from "@/modules/osu/medal/MedalListView.service";
import { MedalListViewDto } from "@domain/osu/views/MedalList.view";

@Button(/^osu_medal_list_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class MedalListPaginationComponent extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly medalListViewService: MedalListViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { action, sessionID } = ctx.params;

        if (!sessionID || !action) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const plain = await this.sessionService.get("osu_medal_list_view", sessionID);
        if (!plain) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = plainToInstance(MedalListViewDto, plain);
        if (data.authorID !== ctx.author.id) {
            throw new Exception(EApplicationError.ACCESS_ERROR);
        }

        const pageSize = this.medalListViewService.getPageSize();
        const totalPages = Math.ceil(data.medals.length / pageSize) || 1;

        if (action === "modal") {
            const modal = new ModalBuilder().setCustomId(`osu_medal_list_modal:${sessionID}`).setTitle("Jump to Page");

            const pageInput = new TextInputBuilder()
                .setCustomId("page_number")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(totalPages.toString().length);

            const pageLabel = new LabelBuilder().setLabel("Page number").setTextInputComponent(pageInput);
            modal.addLabelComponents(pageLabel);
            return await ctx.showModal(modal);
        }

        const newPage = Pagination.calculateNewPage(action, data.page, totalPages);
        if (newPage === data.page) {
            return;
        }

        data.page = newPage;
        await ctx.deferUpdate();

        await this.sessionService.update("osu_medal_list_view", sessionID, data, this.medalListViewService.getTtl());

        await ctx.update(this.medalListViewService.build(sessionID, data));
    }
}

@Modal(/^osu_medal_list_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class MedalListPaginationModal extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly medalListViewService: MedalListViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;

        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const plain = await this.sessionService.get("osu_medal_list_view", sessionID);
        if (!plain) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = plainToInstance(MedalListViewDto, plain);
        if (data.authorID !== ctx.author.id) {
            throw new Exception(EApplicationError.ACCESS_ERROR);
        }

        const input = ctx.getTextInput("page_number");
        if (!input) {
            throw new Exception(EApplicationError.INPUT_ERROR);
        }

        const newPage = parseInt(input, 10);
        const pageSize = this.medalListViewService.getPageSize();
        const totalPages = Math.ceil(data.medals.length / pageSize) || 1;

        if (Number.isNaN(newPage) || newPage < 1 || newPage > totalPages) {
            return;
        }

        await ctx.deferUpdate();
        if (newPage === data.page) {
            return;
        }

        data.page = newPage;

        await this.sessionService.update("osu_medal_list_view", sessionID, data, this.medalListViewService.getTtl());

        await ctx.update(this.medalListViewService.build(sessionID, data));
    }
}
