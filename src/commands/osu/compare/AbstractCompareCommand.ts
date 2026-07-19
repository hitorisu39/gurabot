import { CommandContext } from "@/core/discord/context/CommandContext";
import { Aliases, Command, Examples, Help, Import, IsEnum, IsInlineIndex, IsMods, IsRange, IsString, Option } from "@/core/decorators";
import { OsuService } from "@/modules/osu/Osu.service";
import { CommandOption, ICommandMods, ICommandRange } from "@domain/core/Command";
import { CalculatorService } from "@/modules/osu/calculator/Calculator.service";
import { Grade } from "@generated/adapter/types";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { MapViewService } from "@/modules/osu/map/MapView.service";
import { GraphService } from "@/modules/osu/Graph.service";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { ScoresViewDto } from "@domain/osu/views/Scores.view";
import { EScoreListSize, EScoreQuerySort, EScoreViewLayout, ESortOrder } from "@domain/osu/enums/Score.enum";
import { ScoreViewService } from "@/modules/osu/scores/ScoreView.service";
import { BaseScoreEvaluator } from "@domain/osu/utils/BaseScoreEvaluator";
import { ProviderMeta } from "@generated/adapter";

@Help(`
    Compares your {mode} scores on a specific beatmap.

    **Map Resolution**
    Specify a map ID/URL as the first parameter. If omitted, the command resolves the last beatmap sent in the channel or active reply.
    Use \`version=<diff>\` (or shorthand \`v=<diff>\`) to target a specific difficulty name in the resolved mapset using fuzzy matching.

    **Filters**
    Grades: \`grade=<grade>\` (exact).
    Mods: \`mods=<mods>\`, or shorthand: \`+<mods>!\` (exact), \`+<mods>\` (includes), \`-<mods>!\` (excludes).

    **Sorting & Pagination**
    Sort: \`sort=<option>\` (\`pp\`, \`score\`, \`accuracy\`, \`combo\`, \`misses\`, \`date\`).
    Index: \`index=<index>\` (or shorthand \`i=<index>\`) to view a specific placement.
`)
@Examples(
    "compare",
    "c v=Insane",
    "c sort=score +hd!",
    "c grade=S order=asc i=1-5"
)
export class AbstractCompareCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly graphService: GraphService;
    @Import() declare private readonly mapViewService: MapViewService;
    @Import() declare private readonly calculatorService: CalculatorService;
    @Import() declare private readonly scoreViewService: ScoreViewService;

    @Option("map", "Specify a map url or id")
    declare private readonly map: CommandOption<string>;

    @Option("version", "Specify difficulty name to search for in the mapset")
    @IsString()
    @Aliases("v")
    declare private readonly version: CommandOption<string>;

    @Option("sort", "Sort by standard options (pp, score, accuracy, combo, misses, date)")
    @IsEnum(EScoreQuerySort)
    declare private readonly sort: CommandOption<EScoreQuerySort>;

    @Option("order", "Sort order (Desc - highest first, Asc - lowest first)")
    @IsEnum(ESortOrder)
    declare private readonly order: CommandOption<ESortOrder>;

    @Option("grade", "Filter scores by grade")
    @IsEnum(Grade)
    declare private readonly grade: CommandOption<Grade>;

    @Option("mods", "Filter by mods")
    @IsMods()
    declare private readonly mods: CommandOption<ICommandMods>;

    @Option("index", "Jump to a specific score index")
    @IsInlineIndex()
    @IsRange(1, 100)
    @Aliases("i")
    declare private readonly index: CommandOption<ICommandRange>;

    public async execute(ctx: CommandContext): Promise<void> {
        console.log("COMPARE COMMAND DEBUG:", {
            mapSome: this.map.some(),
            mapValue: this.map.unwrapUnchecked(),
            versionSome: this.version.some(),
            versionValue: this.version.unwrapUnchecked(),
            nameSome: this.name.some(),
            nameValue: this.name.unwrapUnchecked()
        });

        const target = await this.resolveTarget(ctx);
        const user = await this.osuService.user(target.query, target.mode, target.server);

        const resolved = await this.beatmapResolverService.resolveTargetWithVersion(
            ctx,
            this.map,
            this.version,
            target.server,
        );
        if (!resolved.beatmapID) throw new Exception(EApplicationError.NOT_FOUND, "Could not find beatmap.");

        let scores = await this.osuService.userBeatmapScores(user.id, target.mode, resolved.beatmapID, target.server);
        if (!scores || !scores.length)
            throw new Exception(
                EApplicationError.NOT_FOUND,
                `No scores found for **${user.username}** on this beatmap on ${ProviderMeta[target.server].name} (${target.mode}).`
            );

        const sortOption = this.sort.unwrapOr(EScoreQuerySort.PP);
        const orderOption = this.order.unwrapOr(ESortOrder.Descending);

        const evaluator = new BaseScoreEvaluator(
            CommandOption.none<any>(),
            this.mods,
            this.index,
            this.grade,
            sortOption,
            orderOption,
        );

        scores = evaluator.filter(scores);
        scores = evaluator.sort(scores);
        scores = evaluator.index(scores);

        if (!scores.length)
            throw new Exception(EApplicationError.NOT_FOUND, `No scores found matching the specified filters.`);

        const count = scores.length;
        const plural = count === 1 ? "" : "s";

        const displayQuery =
            evaluator.display(count, "on the beatmap:") ?? `Found **${count}** score${plural} on the beatmap:`;

        const data: ScoresViewDto = {
            timestamp: Date.now(),
            authorID: ctx.author.id,
            profile: user,
            scores: scores,
            displayQuery: displayQuery,
            activeAttributes: evaluator.getActiveAttributes(),
            pageSize: EScoreListSize.Detailed,
            page: 1,
            layout: EScoreViewLayout.Compare,
        };

        const pageSize = this.scoreViewService.getPageSize(data.pageSize, data.activeAttributes, data.layout);
        await this.scoreViewService.populatePage(scores, 1, pageSize, target.mode, target.server);
        await this.respondWithSession(ctx, "osu_scores_view", data, this.scoreViewService);
    }
}
