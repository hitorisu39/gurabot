import { Button, Import, Modal } from "@/core/decorators";
import { LeaderboardViewDto } from "@domain/osu/views/Leaderboard.view";
import { LeaderboardViewService } from "@/modules/osu/leaderboard/LeaderboardView.service";
import { AbstractPaginationButton } from "@/components/AbstractPaginationButton";
import { AbstractPaginationModal } from "@/components/AbstractPaginationModal";

@Button(/^osu_leaderboard_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class LeaderboardPaginationComponent extends AbstractPaginationButton<
    "osu_leaderboard_view",
    LeaderboardViewDto
> {
    @Import() declare private readonly leaderboardViewService: LeaderboardViewService;

    protected readonly paginationID = "osu_leaderboard";
    protected readonly sessionKey = "osu_leaderboard_view";
    protected readonly dto = LeaderboardViewDto;

    protected get viewService(): LeaderboardViewService {
        return this.leaderboardViewService;
    }

    protected getCurrentPage(data: LeaderboardViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: LeaderboardViewDto): number {
        return this.leaderboardViewService.getTotalPages(data);
    }

    protected setCurrentPage(data: LeaderboardViewDto, page: number): void {
        data.page = page;
    }

    protected async preparePage(data: LeaderboardViewDto): Promise<void> {
        await this.leaderboardViewService.prepare(data);
    }
}

@Modal(/^osu_leaderboard_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class LeaderboardPaginationModalComponent extends AbstractPaginationModal<
    "osu_leaderboard_view",
    LeaderboardViewDto
> {
    @Import() declare private readonly leaderboardViewService: LeaderboardViewService;

    protected readonly sessionKey = "osu_leaderboard_view";
    protected readonly dto = LeaderboardViewDto;

    protected get viewService(): LeaderboardViewService {
        return this.leaderboardViewService;
    }

    protected getCurrentPage(data: LeaderboardViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: LeaderboardViewDto): number {
        return this.leaderboardViewService.getTotalPages(data);
    }

    protected setCurrentPage(data: LeaderboardViewDto, page: number): void {
        data.page = page;
    }

    protected async preparePage(data: LeaderboardViewDto): Promise<void> {
        await this.leaderboardViewService.prepare(data);
    }
}
