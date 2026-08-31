import { Aliases, Category, Examples, Help, Import, IsEnum, IsMods, IsRange, Option } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { CommandOption, ECommandCategory, ICommandMods, ICommandRange } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { EScoreListSize, ESortOrder } from "@domain/osu/enums/Score.enum";
import { AdapterProvider } from "@generated/adapter/types";
import { OsuService } from "@/modules/osu/Osu.service";
import { OsuStatsService } from "@/modules/osustats/OsuStats.service";
import { OsuStatsScoresViewDto } from "@domain/osustats/views/OsuStatsScores.view";
import { EOsuStatsScoreSort } from "@domain/osustats/enums/OsuStatsScores.enum";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { OsuStatsScoresViewService } from "@/modules/osustats/OsuStatsScoresView.service";
import { rangeInclusiveMax, rangeInclusiveMin } from "@domain/utils/utils";
import { OsuStatsScoresRequestDto } from "@domain/osustats/OsuStatsScores.dto";

@Help(`
    Shows the specified player's {mode} scores that appear on map global leaderboards.

    **Score Filters**
    Ranges supported: \`rank\`, \`accuracy\`.
    Mods: \`mods=<mods>\`, or shorthand: \`+<mods>!\` (exact), \`+<mods>\` (includes), \`-<mods>!\` (excludes).

    **Sorting & Size**
    Sort: \`sort=<option>\` (\`date\`, \`pp\`, \`rank\`, \`accuracy\`, \`combo\`, \`score\`, \`misses\`).
    Order: \`order=asc\` or \`order=desc\`.
    Size: \`size=detailed\` or \`size=compact\`.
`)
@Examples(
    "osustatsscores mrekk rank<=10 accuracy>=99 +hddt",
    "oss mrekk sort=pp order=desc",
    'oss "spaced name" rank=1 size=compact',
)
@Category(ECommandCategory.Osu)
export class AbstractOsuStatsScoresCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly osuStatsService: OsuStatsService;
    @Import() declare private readonly osuStatsScoresViewService: OsuStatsScoresViewService;

    protected forcedServer = AdapterProvider.Bancho;

    @Option("accuracy", "Specify accuracy range")
    @IsRange(0, 100)
    @Aliases("acc", "a")
    declare private readonly accuracy: CommandOption<ICommandRange>;

    @Option("rank", "Specify global leaderboard rank")
    @IsRange(1, 100)
    @Aliases("r")
    declare private readonly rank: CommandOption<ICommandRange>;

    @Option("sort", "Specify score ordering")
    @IsEnum(EOsuStatsScoreSort)
    declare private readonly sort: CommandOption<EOsuStatsScoreSort>;

    @Option("order", "Sort order")
    @IsEnum(ESortOrder)
    declare private readonly order: CommandOption<ESortOrder>;

    @Option("mods", "Filter scores by mods")
    @IsMods()
    declare private readonly mods: CommandOption<ICommandMods>;

    @Option("size", "Format in which scores will be displayed")
    @IsEnum(EScoreListSize)
    declare private readonly size: CommandOption<EScoreListSize>;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const [profile, guildConfig, userConfig] = await Promise.all([
            this.osuService.user(target.query, target.mode, AdapterProvider.Bancho),

            ctx.guild ? this.guildService.get(ctx.guild.id) : Promise.resolve(null),

            this.userService.get(ctx.author.id),
        ]);

        const rank = this.rank.unwrapOr({
            min: 1,
            max: 100,
            minInclusive: true,
            maxInclusive: true,
        });

        const accuracy = this.accuracy.unwrapOr({
            min: 0,
            max: 100,
            minInclusive: true,
            maxInclusive: true,
        });

        const sort = this.sort.unwrapOr(EOsuStatsScoreSort.Date);
        const order = this.order.unwrapOr(
            sort === EOsuStatsScoreSort.Rank ? ESortOrder.Ascending : ESortOrder.Descending,
        );

        const mods = this.mods.unwrapUnchecked();
        const request: OsuStatsScoresRequestDto = {
            username: profile.username,
            mode: target.mode,
            page: 1,
            minRank: rangeInclusiveMin(rank, 1),
            maxRank: rangeInclusiveMax(rank, 1),
            minAccuracy: accuracy.exact ?? accuracy.min,
            maxAccuracy: accuracy.exact ?? accuracy.max,
            sort,
            order,
            modType: mods?.type,
            mods: mods?.mods,
        };

        const firstPage = await this.osuStatsService.scores(request);
        if (!firstPage.total || !firstPage.scores.length) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                `No global leaderboard scores were found for \`${profile.username}\` with these filters.`,
            );
        }

        const pageSize = this.size.unwrapOr(
            userConfig?.scoreListSize ?? guildConfig?.scoreListSize ?? EScoreListSize.Detailed,
        );

        const data: OsuStatsScoresViewDto = {
            timestamp: Date.now(),
            authorID: ctx.author.id,
            profile,
            request,
            page: 1,
            total: firstPage.total,
            apiPageSize: firstPage.scores.length,
            pageSize,
            scores: [],
        };

        await this.osuStatsScoresViewService.prepare(data, firstPage);
        await this.respondWithSession(ctx, "osustats_scores_view", data, this.osuStatsScoresViewService);
    }
}
