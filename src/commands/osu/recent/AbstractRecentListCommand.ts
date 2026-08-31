import {
    Aliases,
    Category,
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
import { Grade } from "@generated/adapter/types";
import { PopulatedScoresQueryDto } from "@domain/osu/Score.dto";
import { CommandOption, ECommandCategory, ICommandMods, ICommandQueryData, ICommandRange } from "@domain/core/Command";
import { EScoreListSize, EScoreQuerySort, ESortOrder } from "@domain/osu/enums/Score.enum";
import { PopulatedScoreEvaluator } from "@domain/osu/utils/PopulatedScoreEvaluator";
import { ScoresViewDto } from "@domain/osu/views/Scores.view";
import { ScoreViewService } from "@/modules/osu/scores/ScoreView.service";
import { Embed } from "@/core/discord/ui/Embed";
import { ProviderMeta } from "@generated/adapter";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { scoreRecentQueryLimit } from "@domain/osu/configs/Score.config";

@Help(`
    Shows most recent {passed}{mode} scores of the specified player.
    You can filter scores by their specific details such as \`accuracy, combo, index, misses, pp\`. All of them support range.
    For mods use this format: \`+mods!\` - exact match, \`+mods\` - includes mods, \`-mods!\` - excludes mods. To show only passes use \`recentpasslist\` command. To filter scores out by grade use \`grade\` option.
    Available grades are \`SSH\`, \`SS\`, \`SH\`, \`S\`, \`A\`, \`B\`, \`C\` and \`D\`.
`)
@Category(ECommandCategory.Osu)
export abstract class AbstractRecentListCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly scoreViewService: ScoreViewService;

    @Option("query", "Filter scores (e.g. pp range, cs, ar, artist, etc.)")
    @IsQuery(PopulatedScoresQueryDto)
    declare private readonly query: CommandOption<ICommandQueryData<PopulatedScoresQueryDto>>;

    @Option("sort", "Specify sorting. For order refer to 'order' option")
    @IsEnum(EScoreQuerySort)
    declare private readonly sort: CommandOption<EScoreQuerySort>;

    @Option("index", "Jump to a specific score index (1-100)")
    @IsInlineIndex()
    @IsRange(1, scoreRecentQueryLimit)
    @Aliases("i")
    declare private readonly index: CommandOption<ICommandRange>;

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

    protected forcedPassed: boolean = false;
    protected forcedSort?: EScoreQuerySort;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const passed = this.forcedPassed;

        const guildConfig = ctx.guild ? await this.guildService.get(ctx.guild.id) : null;
        const userConfig = await this.userService.get(ctx.author.id);

        const sortOption = this.forcedSort ?? this.sort.unwrapOr(EScoreQuerySort.Date);
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
            type: "recent",
            limit: scoreRecentQueryLimit,
            includeFails: !passed,
            provider: target.server,
        });

        if (!scores || scores.length === 0) {
            await ctx.respond(
                Embed.error(
                    `No scores found for **${user.username}** in the past 24 hours on ${ProviderMeta[target.server].name} (${target.mode}).`,
                ),
            );
            return;
        }

        const populatedScores = await this.osuService.populateScores(
            scores,
            evaluator.population,
            target.mode,
            target.server,
        );

        const filtered = evaluator.filter(populatedScores);
        const sorted = evaluator.sort(filtered);
        const finalScores = evaluator.index(sorted);

        if (finalScores.length === 0) {
            await ctx.respond(Embed.error("No recent plays found matching the specified filters."));
            return;
        }

        const pageSize = this.scoreViewService.getPageSize(sizeOption, activeAttributes);
        await this.scoreViewService.populatePage(finalScores, 1, pageSize, target.mode, target.server);

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

        await this.respondWithSession(ctx, "osu_scores_view", data, this.scoreViewService);
    }
}
