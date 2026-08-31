import { Import, SelectMenu } from "@/core/decorators";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { AbstractSessionComponent } from "@/components/AbstractSessionComponent";
import { SnipeService } from "@/modules/snipe/Snipe.service";
import { SnipeRankingViewService } from "@/modules/snipe/SnipeRankingView.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ESnipeRankingSort } from "@domain/snipe/enums/Snipe.enum";
import { SnipeRankingViewDto } from "@domain/snipe/views/SnipeRanking.view";

@SelectMenu(/^snipe_ranking_sort:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class SnipeRankingSortComponent extends AbstractSessionComponent<"snipe_ranking_view", SnipeRankingViewDto> {
    @Import() declare private readonly snipeService: SnipeService;
    @Import() declare private readonly snipeRankingViewService: SnipeRankingViewService;

    protected readonly sessionKey = "snipe_ranking_view";
    protected readonly dto = SnipeRankingViewDto;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;
        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = await this.getData(ctx, sessionID);
        const selected = ctx.values[0] as ESnipeRankingSort;

        if (!Object.values(ESnipeRankingSort).includes(selected)) {
            throw new Exception(EApplicationError.INPUT_ERROR);
        }

        await ctx.deferUpdate();

        if (selected === data.sort) {
            return;
        }

        const ranking = await this.snipeService.ranking(data.country, selected);

        data.sort = selected;
        data.page = 1;
        data.players = ranking.players;

        await this.session.update(this.sessionKey, sessionID, data, this.snipeRankingViewService.getTtl());
        const payload = await this.snipeRankingViewService.build(sessionID, data);
        await ctx.update(payload);
    }
}
