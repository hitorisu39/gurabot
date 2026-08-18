import { Button, Import, Modal } from "@/core/decorators";
import { AbstractComponent } from "@/core/discord/AbstractComponent";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { SessionService } from "@/modules/cache/Session.service";
import { MedalRecentViewService } from "@/modules/osu/medal/MedalRecentView.service";
import { MedalRecentViewDto } from "@domain/osu/views/MedalRecent.view";
import { Pagination } from "@domain/discord/utils/Pagination";
import { plainToInstance } from "class-transformer";
import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

@Button(/^osu_medal_recent_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class MedalRecentPaginationComponent extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly medalRecentViewService: MedalRecentViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { action, sessionID } = ctx.params;

        if (!sessionID || !action) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const plain = await this.sessionService.get("osu_medal_recent_view", sessionID);
        if (!plain) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = plainToInstance(MedalRecentViewDto, plain);
        if (data.authorID !== ctx.author.id) {
            throw new Exception(EApplicationError.ACCESS_ERROR);
        }

        const totalPages = data.medals.length;

        if (action === "modal") {
            const modal = new ModalBuilder()
                .setCustomId(`osu_medal_recent_modal:${sessionID}`)
                .setTitle("Jump to Medal");

            const pageInput = new TextInputBuilder()
                .setCustomId("page_number")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(totalPages.toString().length);

            const pageLabel = new LabelBuilder().setLabel("Medal number").setTextInputComponent(pageInput);
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
            "osu_medal_recent_view",
            sessionID,
            data,
            this.medalRecentViewService.getTtl(),
        );

        await ctx.update(this.medalRecentViewService.build(sessionID, data));
    }
}

@Modal(/^osu_medal_recent_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class MedalRecentPaginationModal extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly medalRecentViewService: MedalRecentViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;

        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const plain = await this.sessionService.get("osu_medal_recent_view", sessionID);

        if (!plain) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = plainToInstance(MedalRecentViewDto, plain);
        if (data.authorID !== ctx.author.id) {
            throw new Exception(EApplicationError.ACCESS_ERROR);
        }

        await ctx.deferUpdate();
        const input = ctx.getTextInput("page_number");

        if (!input) {
            throw new Exception(EApplicationError.INPUT_ERROR);
        }

        const newPage = parseInt(input, 10);
        const totalPages = data.medals.length;
        if (Number.isNaN(newPage) || newPage < 1 || newPage > totalPages) {
            return;
        }

        if (newPage === data.page) {
            return;
        }

        data.page = newPage;
        await this.sessionService.update(
            "osu_medal_recent_view",
            sessionID,
            data,
            this.medalRecentViewService.getTtl(),
        );

        await ctx.update(this.medalRecentViewService.build(sessionID, data));
    }
}
