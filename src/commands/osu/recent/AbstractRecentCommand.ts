import {
    Aliases,
    Category,
    Examples,
    Help,
    Import,
    IsEnum,
    IsInlineIndex,
    IsMods,
    IsRange,
    Option,
} from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { OsuService } from "@/modules/osu/Osu.service";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { CommandOption, ECommandCategory, ICommandMods, ICommandRange } from "@domain/core/Command";
import { Grade, Score } from "@generated/adapter/types";
import { Embed } from "@/core/discord/ui/Embed";
import { ProviderMeta } from "@generated/adapter";
import { BaseScoreEvaluator } from "@domain/osu/utils/BaseScoreEvaluator";
import { EScoreListSize, EScoreQuerySort, ESortOrder } from "@domain/osu/enums/Score.enum";
import { ScoreViewService } from "@/modules/osu/scores/ScoreView.service";
import { ScoresViewDto } from "@domain/osu/views/Scores.view";
import { scoreBestQueryLimit, scoreRecentQueryLimit } from "@domain/osu/configs/Score.config";

@Help(`
    Shows most recent {passed}{mode} score of the specified player.
    You can filter scores by their specific details such as \`accuracy, combo, index, misses, pp\`. All of them support range.
    For mods use this format: \`+mods!\` - exact match, \`+mods\` - includes mods, \`-mods!\` - excludes mods. To show only passes use \`recentpass\` command. To filter scores out by grade use \`grade\` option.
    Available grades are \`SSH\`, \`SS\`, \`SH\`, \`S\`, \`A\`, \`B\`, \`C\` and \`D\`.
`)
@Examples("recent hitorisu", "recent hitorisu +HDHR!", "recent hitorisu grade=S")
@Category(ECommandCategory.Osu)
export abstract class AbstractRecentCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly scoreViewService: ScoreViewService;

    @Option("index", "Jump to a specific score index (1-100)")
    @IsInlineIndex()
    @IsRange()
    @Aliases("i")
    declare private readonly index: CommandOption<ICommandRange>;

    @Option("grade", "Filter scores out by grade")
    @IsEnum(Grade)
    @Aliases("g")
    declare private readonly grade: CommandOption<Grade>;

    @Option("mods", "Filter by mods: +HD = include, -HD! = exclude, +HD! = exact match")
    @IsMods()
    declare private readonly mods: CommandOption<ICommandMods>;

    protected forcedPassed: boolean = false;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const passed = this.forcedPassed;

        const { user, scores } = await this.osuService.userWithScores({
            nameOrID: target.query,
            mode: target.mode,
            type: "recent",
            limit: scoreRecentQueryLimit,
            includeFails: !passed,
            provider: target.server,
        });

        if (!scores.length) {
            await ctx.respond(
                Embed.error(
                    `No scores found for **${user.username}** in the past 24 hours on ${ProviderMeta[target.server].name} (${target.mode}).`,
                ),
            );
            return;
        }

        const evaluator = new BaseScoreEvaluator(
            CommandOption.none<any>(),
            this.mods,
            this.index,
            this.grade,
            EScoreQuerySort.Date,
            ESortOrder.Descending,
        );

        let finalScores = evaluator.filter(scores);
        finalScores = evaluator.sort(finalScores);
        finalScores = evaluator.index(finalScores);

        if (finalScores.length === 0) {
            await ctx.respond(Embed.error("No recent plays found matching the specified filters."));
            return;
        }

        const targetScore = finalScores[0]!;
        finalScores = [targetScore];

        let displayQuery: string | null = null;
        if (!passed) displayQuery = `Try #${this.getTryCount(scores, targetScore)}`;

        const personalScoresPromise = this.osuService.best(user.id, target.mode, scoreBestQueryLimit, target.server);

        const data: ScoresViewDto = {
            timestamp: Date.now(),
            authorID: ctx.author.id,
            profile: user,
            scores: finalScores,
            displayQuery: displayQuery,
            activeAttributes: evaluator.getActiveAttributes(),
            scoreActions: target.scoreActions,
            pageSize: EScoreListSize.Detailed,
            page: 1,
        };

        await this.scoreViewService.prepare(data, { personalScores: personalScoresPromise });
        await this.respondWithSession(ctx, "osu_scores_view", data, this.scoreViewService);
    }

    public getHelpContext(): Record<string, string> {
        return {
            ...super.getHelpContext(),
            passed: this.forcedPassed ? "passed " : "",
        };
    }

    private getTryCount(scores: Array<Score>, targetScore: Score): number {
        const targetMapID = targetScore.beatmapID;
        const targetMods = this.modsKey(targetScore);

        let tries = 0;

        for (let index = scores.length - 1; index >= 0; index--) {
            const score = scores[index];

            if (!score) {
                continue;
            }

            if (score.beatmapID === targetMapID && this.modsKey(score) === targetMods) {
                tries++;
            }

            if (score === targetScore) {
                break;
            }
        }

        return tries;
    }

    private modsKey(score: Score): string {
        return score.mods
            .map((mod) => mod.acronym)
            .sort()
            .join("");
    }
}
