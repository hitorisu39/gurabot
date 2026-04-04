import { EApplicationError, Exception } from "@domain/core/Exception";
import { Button, Import } from "@/core/decorators";
import { AbstractComponent } from "@/core/discord/AbstractComponent";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { SessionService } from "@/modules/cache/Session.service";
import { OsuService } from "@/modules/osu/Osu.service";
import { ScoresViewDto } from "@domain/osu/views/Scores.view";
import { plainToInstance } from "class-transformer";
import { ModalBuilder, TextInputBuilder, TextInputStyle, LabelBuilder } from "discord.js";
import { ScoresViewService } from "@/modules/osu/scores/ScoresView.service";
import { Pagination } from "@domain/discord/utils/Pagination";

@Button(/^osu_scores_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class ScoresPaginationComponent extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly scoresViewService: ScoresViewService;
    @Import() declare private readonly osuService: OsuService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { action, sessionID } = ctx.params;
        if (!sessionID || !action) throw new Exception(EApplicationError.SESSION_EXPIRED);

        const plain = await this.sessionService.get("osu_scores_view", sessionID);
        if (!plain) throw new Exception(EApplicationError.SESSION_EXPIRED);

        const data = plainToInstance(ScoresViewDto, plain);
        if (data.authorID !== ctx.author.id) throw new Exception(EApplicationError.ACCESS_ERROR);

        const pageSize = this.scoresViewService.getPageSize(data.pageSize, data.activeAttributes);
        const totalPages = Math.ceil(data.scores.length / pageSize);

        if (action === "modal") {
            const modal = new ModalBuilder().setCustomId(`osu_scores_modal:${sessionID}`).setTitle("Jump to Page");

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
        if (newPage === data.page) return;
        data.page = newPage;

        await ctx.deferUpdate();

        await this.scoresViewService.populatePage(
            data.scores,
            data.page,
            pageSize,
            data.profile.mode,
            data.profile.provider,
        );
        await this.sessionService.update("osu_scores_view", sessionID, data, this.scoresViewService.getTtl());
        await ctx.update(this.scoresViewService.build(sessionID, data));
    }
}
