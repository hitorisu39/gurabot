import { Button, Import, Modal } from "@/core/decorators";
import { AbstractComponent } from "@/core/discord/AbstractComponent";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { Pagination } from "@domain/discord/utils/Pagination";
import { OsekaiRankingViewDto } from "@domain/osekai/views/OsekaiRanking.view";
import { SessionService } from "@/modules/cache/Session.service";
import { plainToInstance } from "class-transformer";
import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { OsekaiRankingViewService } from "@/modules/osekai/OsekaiRankingView.service";
import { osekaiRankingPageSize } from "@domain/osekai/configs/OsekaiRanking.config";

@Button(/^osekai_ranking_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OsekaiRankingPaginationComponent extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly osekaiRankingViewService: OsekaiRankingViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { action, sessionID } = ctx.params;

        if (!sessionID || !action) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const plain = await this.sessionService.get("osekai_ranking_view", sessionID);
        if (!plain) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = plainToInstance(OsekaiRankingViewDto, plain);
        if (data.authorID !== ctx.author.id) {
            throw new Exception(EApplicationError.ACCESS_ERROR);
        }

        const totalPages = Math.ceil(data.total / osekaiRankingPageSize) || 1;
        if (action === "modal") {
            const modal = new ModalBuilder().setCustomId(`osekai_ranking_modal:${sessionID}`).setTitle("Jump to Page");

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

        await this.osekaiRankingViewService.prepare(data);
        await this.sessionService.update(
            "osekai_ranking_view",
            sessionID,
            data,
            this.osekaiRankingViewService.getTtl(),
        );

        await ctx.update(this.osekaiRankingViewService.build(sessionID, data));
    }
}

@Modal(/^osekai_ranking_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OsekaiRankingPaginationModal extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly osekaiRankingViewService: OsekaiRankingViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;

        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const plain = await this.sessionService.get("osekai_ranking_view", sessionID);
        if (!plain) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = plainToInstance(OsekaiRankingViewDto, plain);
        if (data.authorID !== ctx.author.id) {
            throw new Exception(EApplicationError.ACCESS_ERROR);
        }

        const input = ctx.getTextInput("page_number");
        if (!input) {
            throw new Exception(EApplicationError.INPUT_ERROR);
        }

        const newPage = parseInt(input, 10);
        const totalPages = Math.ceil(data.total / osekaiRankingPageSize) || 1;

        await ctx.deferUpdate();

        if (Number.isNaN(newPage) || newPage < 1 || newPage > totalPages || newPage === data.page) {
            return;
        }

        data.page = newPage;

        await this.osekaiRankingViewService.prepare(data);
        await this.sessionService.update(
            "osekai_ranking_view",
            sessionID,
            data,
            this.osekaiRankingViewService.getTtl(),
        );

        await ctx.update(this.osekaiRankingViewService.build(sessionID, data));
    }
}
