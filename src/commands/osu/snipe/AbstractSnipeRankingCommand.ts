import { Import, IsEnum, Option } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractSessionCommand } from "@/commands/AbstractSessionCommand";
import { SnipeService } from "@/modules/snipe/Snipe.service";
import { SnipeRankingViewService } from "@/modules/snipe/SnipeRankingView.service";
import { CommandOption } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ESnipeRankingSort } from "@domain/snipe/enums/Snipe.enum";
import { SnipeRankingViewDto } from "@domain/snipe/views/SnipeRanking.view";

export abstract class AbstractSnipeRankingCommand extends AbstractSessionCommand {
    @Import() declare private readonly snipeService: SnipeService;
    @Import() declare private readonly snipeRankingViewService: SnipeRankingViewService;

    @Option("sort", "Metric used to rank players.")
    @IsEnum(ESnipeRankingSort)
    declare private readonly sort: CommandOption<ESnipeRankingSort>;

    protected abstract resolveCountry(): string;

    public async execute(ctx: CommandContext): Promise<void> {
        const country = this.resolveCountry();
        const sort = this.sort.unwrapOr(ESnipeRankingSort.WeightedPP);
        const ranking = await this.snipeService.ranking(country, sort);

        if (!ranking.players.length) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                country === "global"
                    ? "No global osu!snipe ranking data was found."
                    : `No osu!snipe ranking data was found for ${country}.`,
            );
        }

        const data: SnipeRankingViewDto = {
            authorID: ctx.author.id,
            country,
            sort,
            page: 1,
            players: ranking.players,
        };

        await this.respondWithSession(ctx, "snipe_ranking_view", data, this.snipeRankingViewService);
    }
}
