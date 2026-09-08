import { Button, Import, Modal } from "@/core/decorators";
import { AbstractPaginationButton } from "@/components/AbstractPaginationButton";
import { AbstractPaginationModal } from "@/components/AbstractPaginationModal";
import { OtrMapViewDto } from "@domain/otr/views/OtrMap.view";
import { otrMapLeaderboardPageSize } from "@domain/otr/configs/OtrMap.config";
import { OtrMapLeaderboardViewService } from "@/modules/otr/views/OtrMapLeaderboardView.service";

@Button(/^otr_map_leaderboard_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OtrMapLeaderboardPaginationComponent extends AbstractPaginationButton<"otr_map_view", OtrMapViewDto> {
    @Import() declare private readonly mapLeaderboardViewService: OtrMapLeaderboardViewService;

    protected readonly paginationID = "otr_map_leaderboard";
    protected readonly sessionKey = "otr_map_view";

    protected readonly dto = OtrMapViewDto;

    protected get viewService(): OtrMapLeaderboardViewService {
        return this.mapLeaderboardViewService;
    }

    protected getCurrentPage(data: OtrMapViewDto): number {
        return data.leaderboardPage;
    }

    protected getTotalPages(data: OtrMapViewDto): number {
        return Math.ceil(data.stats.topPerformers.length / otrMapLeaderboardPageSize);
    }

    protected setCurrentPage(data: OtrMapViewDto, page: number): void {
        data.leaderboardPage = page;
    }

    protected getModalTitle(): string {
        return "Jump to Leaderboard Page";
    }

    protected getModalLabel(_data: OtrMapViewDto, totalPages: number): string {
        return `Page (1-${totalPages})`;
    }
}

@Modal(/^otr_map_leaderboard_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OtrMapLeaderboardPaginationModal extends AbstractPaginationModal<"otr_map_view", OtrMapViewDto> {
    @Import() declare private readonly mapLeaderboardViewService: OtrMapLeaderboardViewService;

    protected readonly sessionKey = "otr_map_view";
    protected readonly dto = OtrMapViewDto;

    protected get viewService(): OtrMapLeaderboardViewService {
        return this.mapLeaderboardViewService;
    }

    protected getCurrentPage(data: OtrMapViewDto): number {
        return data.leaderboardPage;
    }

    protected getTotalPages(data: OtrMapViewDto): number {
        return Math.ceil(data.stats.topPerformers.length / otrMapLeaderboardPageSize);
    }

    protected setCurrentPage(data: OtrMapViewDto, page: number): void {
        data.leaderboardPage = page;
    }
}
