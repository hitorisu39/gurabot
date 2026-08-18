import { Button, Import, Modal } from "@/core/decorators";
import { AbstractComponent } from "@/core/discord/AbstractComponent";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { SessionService } from "@/modules/cache/Session.service";
import { MedalMissingViewService } from "@/modules/osu/medal/MedalMissingView.service";
import { MedalMissingViewDto } from "@domain/osu/views/MedalMissing.view";
import { Pagination } from "@domain/discord/utils/Pagination";
import { plainToInstance } from "class-transformer";
import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

@Button(/^osu_medal_missing_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class MedalMissingPaginationComponent extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly medalMissingViewService: MedalMissingViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { action, sessionID } = ctx.params;

        if (!sessionID || !action) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const plain = await this.sessionService.get("osu_medal_missing_view", sessionID);
        if (!plain) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = plainToInstance(MedalMissingViewDto, plain);
        if (data.authorID !== ctx.author.id) {
            throw new Exception(EApplicationError.ACCESS_ERROR);
        }

        const pageSize = this.medalMissingViewService.getPageSize();
        const totalPages = Math.ceil(data.medals.length / pageSize) || 1;

        if (action === "modal") {
            const modal = new ModalBuilder()
                .setCustomId(`osu_medal_missing_modal:${sessionID}`)
                .setTitle("Jump to Page");

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

        await this.sessionService.update(
            "osu_medal_missing_view",
            sessionID,
            data,
            this.medalMissingViewService.getTtl(),
        );

        await ctx.update(this.medalMissingViewService.build(sessionID, data));
    }
}

@Modal(/^osu_medal_missing_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class MedalMissingPaginationModal extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly medalMissingViewService: MedalMissingViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;

        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const plain = await this.sessionService.get("osu_medal_missing_view", sessionID);
        if (!plain) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = plainToInstance(MedalMissingViewDto, plain);
        if (data.authorID !== ctx.author.id) {
            throw new Exception(EApplicationError.ACCESS_ERROR);
        }

        const input = ctx.getTextInput("page_number");
        if (!input) {
            throw new Exception(EApplicationError.INPUT_ERROR);
        }

        const newPage = parseInt(input, 10);
        const pageSize = this.medalMissingViewService.getPageSize();
        const totalPages = Math.ceil(data.medals.length / pageSize) || 1;

        if (Number.isNaN(newPage) || newPage < 1 || newPage > totalPages) {
            return;
        }

        await ctx.deferUpdate();
        if (newPage === data.page) {
            return;
        }

        data.page = newPage;

        await this.sessionService.update(
            "osu_medal_missing_view",
            sessionID,
            data,
            this.medalMissingViewService.getTtl(),
        );

        await ctx.update(this.medalMissingViewService.build(sessionID, data));
    }
}
