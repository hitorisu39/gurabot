import { CommandContext } from "@/core/discord/context/CommandContext";
import { Aliases, Command, Import, IsEnum, IsInlineIndex, IsMods, IsRange, IsString, Option } from "@/core/decorators";
import { OsuService } from "@/modules/osu/Osu.service";
import { CommandOption, ICommandMods, ICommandRange } from "@domain/core/Command";
import { CalculatorService } from "@/modules/osu/calculator/Calculator.service";
import { Grade } from "@generated/adapter/types";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { SessionService } from "@/modules/cache/Session.service";
import { MapViewService } from "@/modules/osu/map/MapView.service";
import { GraphService } from "@/modules/osu/Graph.service";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { ScoresViewDto } from "@domain/osu/views/Scores.view";
import { EScoreListSize, EScoreQuerySort, EScoreViewLayout, ESortOrder } from "@domain/osu/enums/Score.enum";
import { ScoreViewService } from "@/modules/osu/scores/ScoreView.service";
import { BaseScoreEvaluator } from "@domain/osu/utils/BaseScoreEvaluator";

export enum ECompareSort {
    PP = "pp",
    Score = "score"
}

@Command({
    name: "compare",
    description: "Shows player's scores on the specified or stored beatmap.",
    aliases: ["c", "gap", "mapset"],
})
export class CompareCommand extends AbstractOsuCommand {
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
        const target = await this.resolveTarget(ctx);
        const user = await this.osuService.user(target.query, target.mode, target.server);

        const resolved = await this.beatmapResolverService.resolveTargetWithVersion(ctx, this.map, this.version, target.server);
        if (!resolved.beatmapID)
            throw new Exception(EApplicationError.NOT_FOUND, "Could not find beatmap.");

        let scores = await this.osuService.userBeatmapScores(user.id, target.mode, resolved.beatmapID, target.server);
        if (!scores || !scores.length)
            throw new Exception(EApplicationError.NOT_FOUND, `No scores found for **${user.username}** on this beatmap.`);

        const sortOption = this.sort.unwrapOr(EScoreQuerySort.PP);
        const orderOption = this.order.unwrapOr(ESortOrder.Descending);

        const evaluator = new BaseScoreEvaluator(
            CommandOption.none<any>(),
            this.mods,
            this.index,
            this.grade,
            sortOption,
            orderOption
        );

        scores = evaluator.filter(scores);
        scores = evaluator.sort(scores);
        scores = evaluator.index(scores);

        if (!scores.length)
            throw new Exception(EApplicationError.NOT_FOUND, `No scores found matching the specified filters.`);

        const count = scores.length;
        const plural = count === 1 ? "" : "s";

        const displayQuery = evaluator.display(count, "on the beatmap:") 
            ?? `Found **${count}** score${plural} on the beatmap:`;

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
