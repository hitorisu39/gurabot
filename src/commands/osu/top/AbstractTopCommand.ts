import {
    Aliases,
    Category,
    Examples,
    Help,
    Import,
    IsEnum,
    IsInlineIndex,
    IsMods,
    IsQuery,
    IsRange,
    Option,
} from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { OsuService } from "@/modules/osu/Osu.service";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { Grade } from "@generated/adapter/types";
import { PopulatedScoresQueryDto } from "@domain/osu/Score.dto";
import { CommandOption, ECommandCategory, ICommandMods, ICommandQueryData, ICommandRange } from "@domain/core/Command";
import { EScoreListSize, EScoreQuerySort, ESortOrder } from "@domain/osu/enums/Score.enum";
import { PopulatedScoreEvaluator } from "@domain/osu/utils/PopulatedScoreEvaluator";
import { ScoresViewDto } from "@domain/osu/views/Scores.view";
import { ScoreViewService } from "@/modules/osu/scores/ScoreView.service";
import { scoreBestQueryLimit } from "@domain/osu/configs/Score.config";

@Help(`
    Shows the top {mode} plays of the specified player.

    **Map Filters**
    Ranges supported: \`ar\`, \`cs\`, \`od\`, \`hp\`, \`bpm\`, \`stars\`, \`length\` (in seconds).
    Exact values: \`version\`.

    **Mapset Filters**
    Exact strings: \`artist\`, \`creator\`, \`title\`.
    Date ranges: \`rankdate\` (supports \`YYYY\`, \`YYYY-MM\`, or \`YYYY-MM-DD\`).

    **Score Filters**
    Ranges supported: \`accuracy\`, \`combo\`, \`index\`, \`misses\`, \`pp\`, \`ppfc\`.
    Mods: \`mods=<mods>\`, or shorthand: \`+<mods>!\` (exact), \`+<mods>\` (includes), \`-<mods>!\` (excludes).

    **Sorting & Size**
    Sort: \`sort=<option>\` (\`cs\`, \`ar\`, \`od\`, \`hp\`, \`date\`, \`length\`, \`accuracy\`, \`misses\`, \`combo\`, \`pp\`, \`ppfc\`, \`stars\`, \`rankdate\`).
    Size: \`size=detailed\` or \`size=compact\`.
`)
@Examples(
    "top cs>=4 ar=10 od>=9.8 length>64 +hd",
    "top creator=sotarks +dt bpm>215 sort=date order=asc",
    'top spaced name query="hatsune miku cs>=4"',
)
@Category(ECommandCategory.Osu)
export abstract class AbstractTopCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly profileViewService: ProfileViewService;
    @Import() declare private readonly scoreViewService: ScoreViewService;

    @Option("query", "Filter scores (e.g. pp range, cs, ar, artist, etc.)")
    @IsQuery(PopulatedScoresQueryDto)
    @Aliases("search", "s", "q")
    declare private readonly query: CommandOption<ICommandQueryData<PopulatedScoresQueryDto>>;

    @Option("sort", "Specify sorting. For order refer to 'order' option")
    @IsEnum(EScoreQuerySort)
    declare private readonly sort: CommandOption<EScoreQuerySort>;

    @Option("grade", "Filter scores by grade")
    @IsEnum(Grade)
    @Aliases("g")
    declare private readonly grade: CommandOption<Grade>;

    @Option("order", "Sort order (Desc - highest first, Asc - lowest first)")
    @IsEnum(ESortOrder)
    declare private readonly order: CommandOption<ESortOrder>;

    @Option("mods", "Filter by mods: +HD = include, -HD! = exclude, +HD! = exact match")
    @IsMods()
    declare private readonly mods: CommandOption<ICommandMods>;

    @Option("size", "Format in which the scores will be displayed")
    @IsEnum(EScoreListSize)
    declare private readonly size: CommandOption<EScoreListSize>;

    @Option("index", `Jump to a specific score index (1-${scoreBestQueryLimit}})`)
    @IsInlineIndex()
    @IsRange(1, scoreBestQueryLimit)
    @Aliases("i")
    declare private readonly index: CommandOption<ICommandRange>;

    protected forcedSort?: EScoreQuerySort;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);

        const guildConfig = ctx.guild ? await this.guildService.get(ctx.guild.id) : null;
        const userConfig = await this.userService.get(ctx.author.id);

        const sortOption = this.forcedSort ?? this.sort.unwrapOr(EScoreQuerySort.PP);
        const orderOption = this.order.unwrapOr(ESortOrder.Descending);
        const sizeOption = this.size.unwrapOr(
            userConfig?.scoreListSize ?? guildConfig?.scoreListSize ?? EScoreListSize.Detailed,
        );

        const evaluator = new PopulatedScoreEvaluator(
            this.query,
            this.mods,
            this.index,
            this.grade,
            sortOption,
            orderOption,
        );
        const activeAttributes = evaluator.getActiveAttributes();

        const { user, scores } = await this.osuService.userWithScores({
            nameOrID: target.query,
            mode: target.mode,
            type: "best",
            limit: scoreBestQueryLimit,
            provider: target.server,
        });

        const populatedScores = await this.osuService.populateScores(
            scores,
            evaluator.population,
            target.mode,
            target.server,
        );

        const filtered = evaluator.filter(populatedScores);
        const sorted = evaluator.sort(filtered);
        const finalScores = evaluator.index(sorted);

        const data: ScoresViewDto = {
            timestamp: Date.now(),
            authorID: ctx.author.id,
            profile: user,
            scores: finalScores,
            displayQuery: evaluator.display(finalScores.length),
            activeAttributes: activeAttributes,
            pageSize: sizeOption,
            page: 1,
        };

        await this.scoreViewService.prepare(data, { personalScores: scores });
        await this.respondWithSession(ctx, "osu_scores_view", data, this.scoreViewService);
    }
}
