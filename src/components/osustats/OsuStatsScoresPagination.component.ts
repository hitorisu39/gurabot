import { Button, Import, Modal } from "@/core/decorators";
import { AbstractComponent } from "@/core/discord/AbstractComponent";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { Pagination } from "@domain/discord/utils/Pagination";
import { SessionService } from "@/modules/cache/Session.service";
import { OsuStatsScoresViewDto } from "@domain/osustats/views/OsuStatsScores.view";
import { plainToInstance } from "class-transformer";
import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { OsuStatsScoresViewService } from "@/modules/osustats/OsuStatsScoresView.service";

@Button(/^osustats_scores_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OsuStatsScoresPaginationComponent extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly osuStatsScoresViewService: OsuStatsScoresViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { action, sessionID } = ctx.params;

        if (!sessionID || !action) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const plain = await this.sessionService.get("osustats_scores_view", sessionID);
        if (!plain) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = plainToInstance(OsuStatsScoresViewDto, plain);
        if (data.authorID !== ctx.author.id) {
            throw new Exception(EApplicationError.ACCESS_ERROR);
        }

        const pageSize = this.osuStatsScoresViewService.getPageSize(data);
        const totalPages = Math.ceil(data.total / pageSize) || 1;

        if (action === "modal") {
            const modal = new ModalBuilder().setCustomId(`osustats_scores_modal:${sessionID}`).setTitle("Jump to Page");

            const input = new TextInputBuilder()
                .setCustomId("page_number")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(totalPages.toString().length);

            modal.addLabelComponents(new LabelBuilder().setLabel("Page number").setTextInputComponent(input));

            return await ctx.showModal(modal);
        }

        const newPage = Pagination.calculateNewPage(action, data.page, totalPages);
        if (newPage === data.page) {
            return;
        }

        data.page = newPage;
        await ctx.deferUpdate();

        await this.osuStatsScoresViewService.prepare(data);
        await this.sessionService.update(
            "osustats_scores_view",
            sessionID,
            data,
            this.osuStatsScoresViewService.getTtl(),
        );

        await ctx.update(this.osuStatsScoresViewService.build(sessionID, data));
    }
}

@Modal(/^osustats_scores_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OsuStatsScoresPaginationModal extends AbstractComponent {
    @Import()
    declare private readonly sessionService: SessionService;

    @Import()
    declare private readonly osuStatsScoresViewService: OsuStatsScoresViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;
        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const plain = await this.sessionService.get("osustats_scores_view", sessionID);
        if (!plain) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = plainToInstance(OsuStatsScoresViewDto, plain);
        if (data.authorID !== ctx.author.id) {
            throw new Exception(EApplicationError.ACCESS_ERROR);
        }

        const input = ctx.getTextInput("page_number");
        if (!input) {
            throw new Exception(EApplicationError.INPUT_ERROR);
        }

        const newPage = parseInt(input, 10);
        const pageSize = this.osuStatsScoresViewService.getPageSize(data);
        const totalPages = Math.ceil(data.total / pageSize) || 1;

        if (Number.isNaN(newPage) || newPage < 1 || newPage > totalPages || newPage === data.page) {
            return;
        }

        await ctx.deferUpdate();

        data.page = newPage;
        await this.osuStatsScoresViewService.prepare(data);

        await this.sessionService.update(
            "osustats_scores_view",
            sessionID,
            data,
            this.osuStatsScoresViewService.getTtl(),
        );

        await ctx.update(this.osuStatsScoresViewService.build(sessionID, data));
    }
}
