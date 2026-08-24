import { Import, SelectMenu } from "@/core/decorators";
import { AbstractComponent } from "@/core/discord/AbstractComponent";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { SessionService } from "@/modules/cache/Session.service";
import { SnipeService } from "@/modules/snipe/Snipe.service";
import { SnipeRankingViewService } from "@/modules/snipe/SnipeRankingView.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ESnipeRankingSort } from "@domain/snipe/enums/Snipe.enum";
import { SnipeRankingViewDto } from "@domain/snipe/views/SnipeRanking.view";
import { plainToInstance } from "class-transformer";

@SelectMenu(/^snipe_ranking_sort:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class SnipeRankingSortComponent extends AbstractComponent {
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly snipeService: SnipeService;
    @Import() declare private readonly snipeRankingViewService: SnipeRankingViewService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const sessionID = ctx.params.sessionID;
        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const plain = await this.sessionService.get("snipe_ranking_view", sessionID);
        if (!plain) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = plainToInstance(SnipeRankingViewDto, plain);
        if (data.authorID !== ctx.author.id) {
            throw new Exception(EApplicationError.ACCESS_ERROR);
        }

        const selected = ctx.values[0] as ESnipeRankingSort;

        if (!Object.values(ESnipeRankingSort).includes(selected)) {
            throw new Exception(EApplicationError.INPUT_ERROR);
        }

        if (selected === data.sort) {
            await ctx.deferUpdate();
            return;
        }

        await ctx.deferUpdate();

        const ranking = await this.snipeService.ranking(data.country, selected);

        data.sort = selected;
        data.page = 1;
        data.players = ranking.players;

        await this.sessionService.update("snipe_ranking_view", sessionID, data, this.snipeRankingViewService.getTtl());
        await ctx.update(this.snipeRankingViewService.build(sessionID, data));
    }
}
