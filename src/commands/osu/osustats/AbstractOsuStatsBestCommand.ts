import { Category, Examples, Help, Import, IsEnum, Option } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { CommandOption, ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";
import { ESortOrder } from "@domain/osu/enums/Score.enum";
import { OsuStatsBestEvaluator } from "@domain/osustats/utils/OsuStatsBestEvaluator";
import { OsuStatsBestViewDto } from "@domain/osustats/views/OsuStatsBest.view";
import { OsuStatsService } from "@/modules/osustats/OsuStats.service";
import { OsuStatsBestViewService } from "@/modules/osustats/OsuStatsBestView.service";
import { EOsuStatsBestSort, EOsuStatsBestTimeframe } from "@domain/osustats/enums/OsuStatsBest.enum";
import { AbstractSessionCommand } from "@/commands/AbstractSessionCommand";

@Help(`
    Shows the best recent {mode} scores across all players on map global leaderboards.

    **Timeframe**
    Use \`timeframe=<option>\` to choose the period to inspect. Possible options are \`Yesterday\`, \`LastWeek\`, \`LastMonth\`.

    **Sorting**
    Sort: \`sort=<option>\` (\`pp\`, \`accuracy\`, \`combo\`, \`date\`, \`position\`, \`misses\`, \`score\`).
    Order: \`order=asc\` or \`order=desc\`.
`)
@Examples("osustatsbest", "osb sort=accuracy", "osb sort=position order=asc")
@Category(ECommandCategory.Osu)
export class AbstractOsuStatsBestCommand extends AbstractSessionCommand {
    @Import() declare private readonly osuStatsService: OsuStatsService;
    @Import() declare private readonly osuStatsBestViewService: OsuStatsBestViewService;

    @Option("timeframe", "Specify the timeframe")
    @IsEnum(EOsuStatsBestTimeframe)
    declare private readonly timeframe: CommandOption<EOsuStatsBestTimeframe>;

    @Option("mode", "Specify game mode")
    @IsEnum(GameMode)
    declare private readonly mode: CommandOption<GameMode>;

    @Option("sort", "Specify score ordering")
    @IsEnum(EOsuStatsBestSort)
    declare private readonly sort: CommandOption<EOsuStatsBestSort>;

    @Option("order", "Specify sort order")
    @IsEnum(ESortOrder)
    declare private readonly order: CommandOption<ESortOrder>;

    public async execute(ctx: CommandContext): Promise<void> {
        const timeframe = this.timeframe.unwrapOr(EOsuStatsBestTimeframe.Yesterday);
        const mode = this.mode.unwrapOr(GameMode.Standard);
        const sort = this.sort.unwrapOr(EOsuStatsBestSort.PP);

        const defaultOrder =
            sort === EOsuStatsBestSort.LeaderboardPosition ? ESortOrder.Ascending : ESortOrder.Descending;

        const order = this.order.unwrapOr(defaultOrder);
        const result = await this.osuStatsService.best(timeframe, mode);
        const scores = new OsuStatsBestEvaluator(sort, order).sort(result.scores);

        const data: OsuStatsBestViewDto = {
            authorID: ctx.author.id,
            mode,
            timeframe,
            sort,
            order,
            startDate: result.startDate,
            endDate: result.endDate,
            scores,
            page: 1,
        };

        await this.respondWithSession(ctx, "osustats_best_view", data, this.osuStatsBestViewService);
    }
}
