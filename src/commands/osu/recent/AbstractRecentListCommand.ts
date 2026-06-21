import { Import, IsEnum, IsMods, IsQuery, Option } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { OsuService } from "@/modules/osu/Osu.service";
import { SessionService } from "@/modules/cache/Session.service";
import { Grade, Score } from "@generated/adapter/types";
import { PopulatedScoresQueryDto } from "@domain/osu/Score.dto";
import { CommandOption, ICommandMods, ICommandQueryData, ICommandRange } from "@domain/core/Command";
import { EScoreListSize, EScoreQuerySort, ESortOrder } from "@domain/osu/enums/Score.enum";
import { PopulatedScoreEvaluator } from "@domain/osu/utils/PopulatedScoreEvaluator";
import { ScoresViewDto } from "@domain/osu/views/Scores.view";
import { ScoresViewService } from "@/modules/osu/scores/ScoresView.service";
import { Embed } from "@/core/discord/ui/Embed";
import { ProviderMeta } from "@generated/adapter";
import { AbstractOsuCommand } from "../AbstractOsuCommand";

export abstract class AbstractRecentListCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly scoresViewService: ScoresViewService;

    @Option("query", "Filter scores (e.g. pp range, cs, ar, artist, etc.)")
    @IsQuery(PopulatedScoresQueryDto)
    declare private readonly query: CommandOption<ICommandQueryData<PopulatedScoresQueryDto>>;

    @Option("sort", "Specify sorting. For order refer to 'order' option")
    @IsEnum(EScoreQuerySort)
    declare private readonly sort: CommandOption<EScoreQuerySort>;

    @Option("grade", "Filter scores by grade")
    @IsEnum(Grade)
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
            CommandOption.none<ICommandRange>(),
            this.grade,
            sortOption,
            orderOption,
        );
        const activeAttributes = evaluator.getActiveAttributes();

        const { user, scores } = await this.osuService.userWithScores({
            nameOrID: target.query,
            mode: target.mode,
            type: "recent",
            limit: 100,
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

        let workingScores: Array<Score> = scores;

        if (evaluator.withMaps || evaluator.populated) {
            const scoresWithMaps = await this.osuService.populateMaps(scores);
            workingScores = scoresWithMaps;

            if (evaluator.populated) {
                const populatedScores = await this.osuService.populateCalculations(scoresWithMaps, target.mode, true);
                workingScores = populatedScores;
            }
        }

        let finalScores = evaluator.filter(workingScores);
        finalScores = evaluator.sort(finalScores);
        finalScores = evaluator.index(finalScores);

        if (finalScores.length === 0) {
            await ctx.respond(Embed.error("No recent plays found matching the specified filters."));
            return;
        }

        const pageSize = this.scoresViewService.getPageSize(sizeOption, activeAttributes);
        await this.scoresViewService.populatePage(finalScores, 1, pageSize, target.mode, target.server);

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

        const sessionID = await this.sessionService.create("osu_scores_view", data, this.scoresViewService.getTtl());

        const view = this.scoresViewService.build(sessionID, data);
        const message = await ctx.respond(view);

        this.sessionService.after(sessionID, () => message?.edit({ components: [] }));
    }
}
