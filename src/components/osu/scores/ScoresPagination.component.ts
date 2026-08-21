import { Button, Import, Modal } from "@/core/decorators";
import { ScoresViewDto } from "@domain/osu/views/Scores.view";
import { ScoreViewService } from "@/modules/osu/scores/ScoreView.service";
import { AbstractPaginationButton } from "@/components/AbstractPaginationButton";
import { AbstractPaginationModal } from "@/components/AbstractPaginationModal";

@Button(/^osu_scores_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class ScoresPaginationComponent extends AbstractPaginationButton<"osu_scores_view", ScoresViewDto> {
    @Import() declare private readonly scoreViewService: ScoreViewService;

    protected readonly paginationID = "osu_scores";
    protected readonly sessionKey = "osu_scores_view";
    protected readonly dto = ScoresViewDto;

    protected get viewService(): ScoreViewService {
        return this.scoreViewService;
    }

    protected getCurrentPage(data: ScoresViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: ScoresViewDto): number {
        const pageSize = this.viewService.getPageSize(data.pageSize, data.activeAttributes, data.layout);
        return Math.ceil(data.scores.length / pageSize) || 1;
    }

    protected setCurrentPage(data: ScoresViewDto, page: number): void {
        data.page = page;
    }

    protected async preparePage(data: ScoresViewDto): Promise<void> {
        const pageSize = this.viewService.getPageSize(data.pageSize, data.activeAttributes, data.layout);
        await this.viewService.populatePage(data.scores, data.page, pageSize, data.profile.mode, data.profile.provider);
    }
}

@Modal(/^osu_scores_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class ScoresPaginationModal extends AbstractPaginationModal<"osu_scores_view", ScoresViewDto> {
    @Import() declare private readonly scoreViewService: ScoreViewService;

    protected readonly sessionKey = "osu_scores_view";
    protected readonly dto = ScoresViewDto;

    protected get viewService(): ScoreViewService {
        return this.scoreViewService;
    }

    protected getCurrentPage(data: ScoresViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: ScoresViewDto): number {
        const pageSize = this.viewService.getPageSize(data.pageSize, data.activeAttributes, data.layout);
        return Math.ceil(data.scores.length / pageSize) || 1;
    }

    protected setCurrentPage(data: ScoresViewDto, page: number): void {
        data.page = page;
    }

    protected async preparePage(data: ScoresViewDto): Promise<void> {
        const pageSize = this.viewService.getPageSize(data.pageSize, data.activeAttributes, data.layout);
        await this.viewService.populatePage(data.scores, data.page, pageSize, data.profile.mode, data.profile.provider);
    }
}
