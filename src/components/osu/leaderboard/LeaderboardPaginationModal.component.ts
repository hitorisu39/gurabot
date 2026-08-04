import { Import, Modal } from "@/core/decorators";
import { AbstractComponent } from "@/core/discord/AbstractComponent";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { SessionService } from "@/modules/cache/Session.service";
import { LeaderboardViewService } from "@/modules/osu/leaderboard/LeaderboardView.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { LeaderboardViewDto } from "@domain/osu/views/Leaderboard.view";
import { plainToInstance } from "class-transformer";

@Modal(/^osu_leaderboard_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class LeaderboardPaginationModalComponent extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly leaderboardViewService: LeaderboardViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;
        if (!sessionID) {
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

        const input = ctx.getTextInput("page_number");

        if (!input) {
            throw new Exception(EApplicationError.INPUT_ERROR);
        }

        const newPage = Number.parseInt(input, 10);
        const totalPages = this.leaderboardViewService.getTotalPages(data);

        await ctx.deferUpdate();

        if (Number.isNaN(newPage) || newPage < 1 || newPage > totalPages || newPage === data.page) {
            return;
        }

        data.page = newPage;

        await this.leaderboardViewService.prepare(data);
        await this.sessionService.update("osu_leaderboard_view", sessionID, data, this.leaderboardViewService.getTtl());

        await ctx.update(this.leaderboardViewService.build(sessionID, data));
    }
}
