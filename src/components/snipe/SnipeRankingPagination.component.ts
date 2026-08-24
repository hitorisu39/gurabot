import { Button, Import, Modal } from "@/core/decorators";
import { AbstractPaginationButton } from "@/components/AbstractPaginationButton";
import { AbstractPaginationModal } from "@/components/AbstractPaginationModal";
import { snipeRankingPageSize } from "@domain/snipe/configs/Snipe.config";
import { SnipeRankingViewDto } from "@domain/snipe/views/SnipeRanking.view";
import { SnipeRankingViewService } from "@/modules/snipe/SnipeRankingView.service";

@Button(/^snipe_ranking_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class SnipeRankingPaginationComponent extends AbstractPaginationButton<
    "snipe_ranking_view",
    SnipeRankingViewDto
> {
    @Import() declare private readonly snipeRankingViewService: SnipeRankingViewService;

    protected readonly paginationID = "snipe_ranking";
    protected readonly sessionKey = "snipe_ranking_view";
    protected readonly dto = SnipeRankingViewDto;

    protected get viewService(): SnipeRankingViewService {
        return this.snipeRankingViewService;
    }

    protected getCurrentPage(data: SnipeRankingViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: SnipeRankingViewDto): number {
        return Math.max(1, Math.ceil(data.players.length / snipeRankingPageSize));
    }

    protected setCurrentPage(data: SnipeRankingViewDto, page: number): void {
        data.page = page;
    }

    protected getModalTitle(): string {
        return "Jump to Ranking Page";
    }
}

@Modal(/^snipe_ranking_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class SnipeRankingPaginationModal extends AbstractPaginationModal<"snipe_ranking_view", SnipeRankingViewDto> {
    @Import() declare private readonly snipeRankingViewService: SnipeRankingViewService;

    protected readonly sessionKey = "snipe_ranking_view";
    protected readonly dto = SnipeRankingViewDto;

    protected get viewService(): SnipeRankingViewService {
        return this.snipeRankingViewService;
    }

    protected getCurrentPage(data: SnipeRankingViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: SnipeRankingViewDto): number {
        return Math.max(1, Math.ceil(data.players.length / snipeRankingPageSize));
    }

    protected setCurrentPage(data: SnipeRankingViewDto, page: number): void {
        data.page = page;
    }
}
