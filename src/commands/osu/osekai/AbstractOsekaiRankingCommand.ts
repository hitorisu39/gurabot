import { AbstractSessionCommand } from "@/commands/AbstractSessionCommand";
import { Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { OsekaiRankingViewService } from "@/modules/osekai/OsekaiRankingView.service";
import { EOsekaiRanking } from "@domain/osekai/enums/OsekaiRanking.enum";
import { OsekaiRankingViewDto } from "@domain/osekai/views/OsekaiRanking.view";

export abstract class AbstractOsekaiRankingCommand extends AbstractSessionCommand {
    @Import() declare private readonly osekaiRankingViewService: OsekaiRankingViewService;

    protected abstract getRanking(): EOsekaiRanking;

    public async execute(ctx: CommandContext): Promise<void> {
        const data: OsekaiRankingViewDto = {
            authorID: ctx.author.id,
            ranking: this.getRanking(),
            page: 1,
            total: 0,
            entries: [],
        };

        await this.osekaiRankingViewService.prepare(data);
        await this.respondWithSession(ctx, "osekai_ranking_view", data, this.osekaiRankingViewService);
    }
}
