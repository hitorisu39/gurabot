import { Button, Import } from "@/core/decorators";
import { AbstractComponent } from "@/core/discord/AbstractComponent";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { SessionService } from "@/modules/cache/Session.service";
import { LeaderboardViewService } from "@/modules/osu/leaderboard/LeaderboardView.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { Pagination } from "@domain/discord/utils/Pagination";
import { LeaderboardViewDto } from "@domain/osu/views/Leaderboard.view";
import { plainToInstance } from "class-transformer";
import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

@Button(/^osu_leaderboard_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class LeaderboardPaginationComponent extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly leaderboardViewService: LeaderboardViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { action, sessionID } = ctx.params;

        if (!sessionID || !action) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const plain = await this.sessionService.get("osu_leaderboard_view", sessionID);

        if (!plain) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = plainToInstance(LeaderboardViewDto, plain);

        if (data.authorID !== ctx.author.id) {
            throw new Exception(EApplicationError.ACCESS_ERROR);
        }

        const totalPages = this.leaderboardViewService.getTotalPages(data);

        if (action === "modal") {
            const modal = new ModalBuilder().setCustomId(`osu_leaderboard_modal:${sessionID}`).setTitle("Jump to Page");

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

        await ctx.deferUpdate();

        if (newPage === data.page) {
            return;
        }

        data.page = newPage;

        await this.leaderboardViewService.prepare(data);
        await this.sessionService.update("osu_leaderboard_view", sessionID, data, this.leaderboardViewService.getTtl());

        await ctx.update(this.leaderboardViewService.build(sessionID, data));
    }
}
