import { Button, Import, Modal } from "@/core/decorators";
import { AbstractPaginationButton } from "@/components/AbstractPaginationButton";
import { AbstractPaginationModal } from "@/components/AbstractPaginationModal";
import { OtrLeaderboardViewDto } from "@domain/otr/views/OtrLeaderboard.view";
import { OtrLeaderboardViewService } from "@/modules/otr/views/OtrLeaderboardView.service";

@Button(/^otr_leaderboard_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OtrLeaderboardPaginationComponent extends AbstractPaginationButton<
    "otr_leaderboard_view",
    OtrLeaderboardViewDto
> {
    @Import() declare private readonly leaderboardViewService: OtrLeaderboardViewService;
    protected readonly paginationID = "otr_leaderboard";
    protected readonly sessionKey = "otr_leaderboard_view";
    protected readonly dto = OtrLeaderboardViewDto;

    protected get viewService(): OtrLeaderboardViewService {
        return this.leaderboardViewService;
    }

    protected getCurrentPage(data: OtrLeaderboardViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: OtrLeaderboardViewDto): number {
        return this.leaderboardViewService.getTotalPages(data);
    }

    protected setCurrentPage(data: OtrLeaderboardViewDto, page: number): void {
        data.page = page;
    }

    protected async preparePage(data: OtrLeaderboardViewDto): Promise<void> {
        await this.leaderboardViewService.prepare(data);
    }
}

@Modal(/^otr_leaderboard_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OtrLeaderboardPaginationModalComponent extends AbstractPaginationModal<
    "otr_leaderboard_view",
    OtrLeaderboardViewDto
> {
    @Import() declare private readonly leaderboardViewService: OtrLeaderboardViewService;
    protected readonly sessionKey = "otr_leaderboard_view";
    protected readonly dto = OtrLeaderboardViewDto;

    protected get viewService(): OtrLeaderboardViewService {
        return this.leaderboardViewService;
    }

    protected getCurrentPage(data: OtrLeaderboardViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: OtrLeaderboardViewDto): number {
        return this.leaderboardViewService.getTotalPages(data);
    }

    protected setCurrentPage(data: OtrLeaderboardViewDto, page: number): void {
        data.page = page;
    }

    protected async preparePage(data: OtrLeaderboardViewDto): Promise<void> {
        await this.leaderboardViewService.prepare(data);
    }
}
