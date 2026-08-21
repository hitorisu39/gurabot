import { Button, Import, Modal } from "@/core/decorators";
import { AbstractPaginationButton } from "@/components/AbstractPaginationButton";
import { AbstractPaginationModal } from "@/components/AbstractPaginationModal";
import { OsuStatsScoresViewDto } from "@domain/osustats/views/OsuStatsScores.view";
import { OsuStatsScoresViewService } from "@/modules/osustats/OsuStatsScoresView.service";

@Button(/^osustats_scores_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OsuStatsScoresPaginationComponent extends AbstractPaginationButton<
    "osustats_scores_view",
    OsuStatsScoresViewDto
> {
    @Import() declare private readonly osuStatsScoresViewService: OsuStatsScoresViewService;

    protected readonly paginationID = "osustats_scores";
    protected readonly sessionKey = "osustats_scores_view";
    protected readonly dto = OsuStatsScoresViewDto;

    protected get viewService(): OsuStatsScoresViewService {
        return this.osuStatsScoresViewService;
    }

    protected getCurrentPage(data: OsuStatsScoresViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: OsuStatsScoresViewDto): number {
        const pageSize = this.osuStatsScoresViewService.getPageSize(data);
        return Math.ceil(data.total / pageSize) || 1;
    }

    protected setCurrentPage(data: OsuStatsScoresViewDto, page: number): void {
        data.page = page;
    }

    protected async preparePage(data: OsuStatsScoresViewDto): Promise<void> {
        await this.osuStatsScoresViewService.prepare(data);
    }
}

@Modal(/^osustats_scores_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OsuStatsScoresPaginationModal extends AbstractPaginationModal<
    "osustats_scores_view",
    OsuStatsScoresViewDto
> {
    @Import() declare private readonly osuStatsScoresViewService: OsuStatsScoresViewService;

    protected readonly sessionKey = "osustats_scores_view";
    protected readonly dto = OsuStatsScoresViewDto;

    protected get viewService(): OsuStatsScoresViewService {
        return this.osuStatsScoresViewService;
    }

    protected getCurrentPage(data: OsuStatsScoresViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: OsuStatsScoresViewDto): number {
        const pageSize = this.osuStatsScoresViewService.getPageSize(data);
        return Math.ceil(data.total / pageSize) || 1;
    }

    protected setCurrentPage(data: OsuStatsScoresViewDto, page: number): void {
        data.page = page;
    }

    protected async preparePage(data: OsuStatsScoresViewDto): Promise<void> {
        await this.osuStatsScoresViewService.prepare(data);
    }
}
