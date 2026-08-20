import { Button, Import, Modal } from "@/core/decorators";
import { AbstractComponent } from "@/core/discord/AbstractComponent";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { Pagination } from "@domain/discord/utils/Pagination";
import { SessionService } from "@/modules/cache/Session.service";
import { plainToInstance } from "class-transformer";
import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { OsuStatsBestViewService } from "@/modules/osustats/OsuStatsBestView.service";
import { OsuStatsBestViewDto } from "@domain/osustats/views/OsuStatsBest.view";
import { osuStatsBestPageSize } from "@domain/osustats/configs/OsuStatsBest.config";
import { osekaiRankingPageSize } from "@domain/osekai/configs/OsekaiRanking.config";

@Button(/^osustats_best_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OsuStatsBestPaginationComponent extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly osuStatsBestViewService: OsuStatsBestViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { action, sessionID } = ctx.params;
        if (!sessionID || !action) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const plain = await this.sessionService.get("osustats_best_view", sessionID);
        if (!plain) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = plainToInstance(OsuStatsBestViewDto, plain);
        if (data.authorID !== ctx.author.id) {
            throw new Exception(EApplicationError.ACCESS_ERROR);
        }

        const totalPages = Math.ceil(data.scores.length / osuStatsBestPageSize) || 1;

        if (action === "modal") {
            const modal = new ModalBuilder().setCustomId(`osustats_best_modal:${sessionID}`).setTitle("Jump to Page");

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
        await this.sessionService.update("osustats_best_view", sessionID, data, this.osuStatsBestViewService.getTtl());

        await ctx.update(this.osuStatsBestViewService.build(sessionID, data));
    }
}

@Modal(/^osustats_best_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OsuStatsBestPaginationModal extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly osuStatsBestViewService: OsuStatsBestViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;
        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const plain = await this.sessionService.get("osustats_best_view", sessionID);
        if (!plain) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = plainToInstance(OsuStatsBestViewDto, plain);
        if (data.authorID !== ctx.author.id) {
            throw new Exception(EApplicationError.ACCESS_ERROR);
        }

        const input = ctx.getTextInput("page_number");
        if (!input) {
            throw new Exception(EApplicationError.INPUT_ERROR);
        }

        const newPage = parseInt(input, 10);
        const totalPages = Math.ceil(data.scores.length / osekaiRankingPageSize) || 1;

        await ctx.deferUpdate();

        if (Number.isNaN(newPage) || newPage < 1 || newPage > totalPages || newPage === data.page) {
            return;
        }

        data.page = newPage;

        await ctx.deferUpdate();
        await this.sessionService.update("osustats_best_view", sessionID, data, this.osuStatsBestViewService.getTtl());

        await ctx.update(this.osuStatsBestViewService.build(sessionID, data));
    }
}
