import { Import } from "@/core/decorators";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { OsuService } from "@/modules/osu/Osu.service";
import { ScoreViewService } from "@/modules/osu/scores/ScoreView.service";
import { Pagination } from "@domain/discord/utils/Pagination";
import { ScoresViewDto } from "@domain/osu/views/Scores.view";
import { OsuStatsScoresViewDto } from "@domain/osustats/views/OsuStatsScores.view";
import { OsuStatsFormatter } from "@domain/osustats/formatters/OsuStats.formatter";
import { AdapterProvider } from "@generated/adapter/types";
import { EScoreViewLayout } from "@domain/osu/enums/Score.enum";
import { OsuStatsService } from "./OsuStats.service";
import { plainToInstance } from "class-transformer";
import { OsuStatsScoresPageDto, OsuStatsScoresRequestDto } from "@domain/osustats/OsuStatsScores.dto";

export class OsuStatsScoresViewService extends AbstractViewService<OsuStatsScoresViewDto> {
    @Import() declare private readonly osuStatsService: OsuStatsService;
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly scoreViewService: ScoreViewService;

    protected readonly ttl = 180;

    public getPageSize(data: OsuStatsScoresViewDto): number {
        return this.scoreViewService.getPageSize(data.pageSize, [], EScoreViewLayout.List);
    }

    public async prepare(data: OsuStatsScoresViewDto, initialPage?: OsuStatsScoresPageDto): Promise<void> {
        const pageSize = this.getPageSize(data);
        const start = (data.page - 1) * pageSize;
        const end = Math.min(start + pageSize, data.total);

        if (start >= data.total || end <= start) {
            data.scores = [];
            return;
        }

        const firstApiPage = Math.floor(start / data.apiPageSize) + 1;
        const lastApiPage = Math.floor((end - 1) / data.apiPageSize) + 1;
        const pages: Array<Promise<OsuStatsScoresPageDto>> = [];

        for (let page = firstApiPage; page <= lastApiPage; page++) {
            if (page === 1 && initialPage) {
                pages.push(Promise.resolve(initialPage));

                continue;
            }

            pages.push(this.osuStatsService.scores(this.requestPage(data.request, page)));
        }

        const responses = await Promise.all(pages);
        const remoteScores = responses.flatMap((response) => response.scores);
        const remoteStart = (firstApiPage - 1) * data.apiPageSize;
        const localStart = start - remoteStart;
        const selected = remoteScores.slice(localStart, localStart + pageSize);

        for (let i = 0; i < selected.length; i++) {
            selected[i]!.index = start + i + 1;
        }

        data.scores = await this.osuService.populateAll(selected, data.profile.mode, true, AdapterProvider.Bancho);
    }

    public build(sessionID: string, data: OsuStatsScoresViewDto): TMessagePayload {
        const pageSize = this.getPageSize(data);
        const totalPages = Math.ceil(data.total / pageSize) || 1;

        const components =
            totalPages > 1 ? [Pagination.build("osustats_scores", sessionID, data.page, totalPages)] : [];

        const renderData: ScoresViewDto = {
            timestamp: data.timestamp,
            authorID: data.authorID,
            profile: data.profile,
            scores: data.scores,
            displayQuery: null,
            activeAttributes: [],
            scoreActions: false,
            pageSize: data.pageSize,
            page: 1,
            layout: EScoreViewLayout.List,
        };

        const embed = this.scoreViewService.render(renderData, data.scores);

        return {
            content: OsuStatsFormatter.scoresFilters(data.request),
            embeds: [embed],
            components,
        };
    }

    private requestPage(request: OsuStatsScoresRequestDto, page: number): OsuStatsScoresRequestDto {
        return plainToInstance(OsuStatsScoresRequestDto, {
            ...request,
            page,
        });
    }
}
