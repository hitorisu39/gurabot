import { Aliases, Examples, Help, Import, IsEnum, IsInlineIndex, IsMods, IsRange, Option } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { OsuService } from "@/modules/osu/Osu.service";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { CommandOption, ICommandMods, ICommandRange } from "@domain/core/Command";
import { Grade } from "@generated/adapter/types";
import { Embed } from "@/core/discord/ui/Embed";
import { ProviderMeta } from "@generated/adapter";
import { BaseScoreEvaluator } from "@domain/osu/utils/BaseScoreEvaluator";
import { EScoreListSize, EScoreQuerySort, ESortOrder } from "@domain/osu/enums/Score.enum";
import { ScoreViewService } from "@/modules/osu/scores/ScoreView.service";
import { ScoresViewDto } from "@domain/osu/views/Scores.view";
import { SessionService } from "@/modules/cache/Session.service";

@Help(`
    Shows most recent {passed}{mode} score of the specified player.
    You can filter scores by their specific details such as \`accuracy, combo, index, misses, pp\`. All of them support range.
    For mods use this format: \`+mods!\` - exact match, \`+mods\` - includes mods, \`-mods!\` - excludes mods. To show only passes use \`recentpass\` command. To filter scores out by grade use \`grade\` option.
    Available grades are \`SSH\`, \`SS\`, \`SH\`, \`S\`, \`A\`, \`B\`, \`C\` and \`D\`.
`)
@Examples(
    "recent hitorisu",
    "recent hitorisu +HDHR!",
    "recent hitorisu grade=S"
)
export abstract class AbstractRecentCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly scoreViewService: ScoreViewService;

    @Option("index", "Jump to a specific score index (1-100)")
    @IsInlineIndex()
    @IsRange()
    @Aliases("i")
    declare private readonly index: CommandOption<ICommandRange>;

    @Option("grade", "Filter scores out by grade")
    @IsEnum(Grade)
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

        if (!passed) {
            const targetMapID = targetScore.beatmapID;
            const targetMods = targetScore.mods
                .map((m) => m.acronym)
                .sort()
                .join("");

            let tries = 0;

            // Iterate from oldest to newest to calculate tries
            for (let i = scores.length - 1; i >= 0; i--) {
                const s = scores[i];
                const sMapID = s?.beatmapID;
                const sMods = s?.mods
                    .map((m) => m.acronym)
                    .sort()
                    .join("");

                if (sMapID === targetMapID && sMods === targetMods) tries++;

                if (s === targetScore) break;
            }

            displayQuery = `Try #${tries}`;
        }

        await this.scoreViewService.populatePage(finalScores, 1, 1, target.mode, target.server);

        const data: ScoresViewDto = {
            timestamp: Date.now(),
            authorID: ctx.author.id,
            profile: user,
            scores: finalScores,
            displayQuery: displayQuery,
            activeAttributes: evaluator.getActiveAttributes(),
            pageSize: EScoreListSize.Detailed,
            page: 1,
        };

        const sessionID = await this.sessionService.create("osu_scores_view", data, this.scoreViewService.getTtl());

        const view = this.scoreViewService.build(sessionID, data);
        const message = await ctx.respond(view);

        this.sessionService.after(sessionID, () => message?.edit({ components: [] }));
    }

    public getHelpContext(): Record<string, string> {
        return {
            ...super.getHelpContext(),
            passed: this.forcedPassed ? "passed " : "",
        };
    }
}
