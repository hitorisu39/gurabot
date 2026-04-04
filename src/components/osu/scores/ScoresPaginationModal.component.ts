import { EApplicationError, Exception } from "@domain/core/Exception";
import { Modal, Import } from "@/core/decorators";
import { AbstractComponent } from "@/core/discord/AbstractComponent";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { SessionService } from "@/modules/cache/Session.service";
import { ScoresViewDto } from "@domain/osu/views/Scores.view";
import { plainToInstance } from "class-transformer";
import { ScoresViewService } from "@/modules/osu/scores/ScoresView.service";

@Modal(/^osu_scores_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class ScoresPaginationModal extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly scoresViewService: ScoresViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;
        if (!sessionID) throw new Exception(EApplicationError.SESSION_EXPIRED);

        const plain = await this.sessionService.get("osu_scores_view", sessionID);
        if (!plain) throw new Exception(EApplicationError.SESSION_EXPIRED);

        const data = plainToInstance(ScoresViewDto, plain);
        if (data.authorID !== ctx.author.id) throw new Exception(EApplicationError.ACCESS_ERROR);

        await ctx.deferUpdate();

        const input = ctx.getTextInput("page_number");
        if (!input) throw new Exception(EApplicationError.INPUT_ERROR);

        const newPage = parseInt(input);

        const pageSize = this.scoresViewService.getPageSize(data.pageSize, data.activeAttributes);
        const totalPages = Math.ceil(data.scores.length / pageSize);

        if (isNaN(newPage) || newPage < 1 || newPage > totalPages) return;

        if (newPage === data.page) {
            await ctx.deferUpdate();
            return;
        }

        await ctx.deferUpdate();
        data.page = newPage;

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
