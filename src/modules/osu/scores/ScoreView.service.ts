import { Import } from "@/core/decorators";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { AbstractService } from "@/core/framework/AbstractService";
import { Pagination } from "@domain/discord/utils/Pagination";
import { PopulatedScore } from "@domain/osu/Score.dto";
import { ScoresViewDto } from "@domain/osu/views/Scores.view";
import { AdapterProvider, GameMode, Score } from "@generated/adapter/types";
import { OsuService } from "../Osu.service";
import { ProfileViewService } from "../profile/ProfileView.service";
import { scoreCompactPageSize, scoreDetailedPageSize, scoreStatsDelimiter } from "@domain/osu/configs/Score.config";
import { EScoreListSize, EScoreViewLayout } from "@domain/osu/enums/Score.enum";

// Views
import { AbstractScoreView } from "./AbstractScoreView";
import { ListScoreView } from "./ListScoreView.service";
import { CompareScoreView } from "./CompareScoreView.service";
import { ScoreUtils } from "@domain/osu/utils/ScoreUtils";

export class ScoreViewService extends AbstractService {
    @Import() declare private readonly osuService: OsuService;
    
    // Views services
    @Import() declare private readonly listScoreView: ListScoreView;
    @Import() declare private readonly compareScoreView: CompareScoreView;

    private readonly ttl: number = 180;
    private views: Map<EScoreViewLayout, AbstractScoreView> = new Map();

    public init(): void {
        this.views = new Map([
            [EScoreViewLayout.List, this.listScoreView],
            [EScoreViewLayout.Compare, this.compareScoreView]
        ]);
    }

    public build(sessionID: string, data: ScoresViewDto, meta?: Record<string, unknown>): TMessagePayload {
        const layout = data.layout ?? EScoreViewLayout.List;
        const view = this.getView(layout);

        const pageSize = view.getPageSize(data.pageSize, data.activeAttributes);
        const totalPages = Math.ceil(data.scores.length / pageSize) || 1;

        const start = (data.page - 1) * pageSize;
        const end = start + pageSize;
        const pageScores = data.scores.slice(start, end);

        const components = totalPages > 1 ? [Pagination.build("osu_scores", sessionID, data.page, totalPages)] : [];

        const embed = (data.scores.length === 1 && pageScores[0]) 
            ? view.renderSingle(data, pageScores[0]) 
            : view.render(data, pageScores, meta);

        return {
            content: data.displayQuery ?? undefined,
            embeds: [embed],
            components: components,
        };
    }

    public getPageSize(
        size: EScoreListSize, 
        activeAttributes?: Array<string>, 
        layout: EScoreViewLayout = EScoreViewLayout.List
    ): number {
        return this.getView(layout).getPageSize(size, activeAttributes);
    }

    public getTtl(): number {
        return this.ttl;
    }

    public async populatePage(
        scores: Array<Score>,
        page: number,
        pageSize: number,
        mode: GameMode,
        server: AdapterProvider,
    ): Promise<void> {
        const start = (page - 1) * pageSize;
        const slice = scores.slice(start, start + pageSize);

        if (slice.every((s) => ScoreUtils.isFullyPopulated(s))) {
            return;
        }

        const populated = await this.osuService.populateAll(slice, mode, true, server);
        scores.splice(start, populated.length, ...populated);
    }

    private getView(layout: EScoreViewLayout): AbstractScoreView {
        return this.views.get(layout) ?? this.listScoreView;
    }
}
