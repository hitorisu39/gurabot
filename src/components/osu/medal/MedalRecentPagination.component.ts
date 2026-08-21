import { Button, Import, Modal } from "@/core/decorators";
import { AbstractPaginationButton } from "@/components/AbstractPaginationButton";
import { AbstractPaginationModal } from "@/components/AbstractPaginationModal";
import { MedalRecentViewDto } from "@domain/osu/views/MedalRecent.view";
import { MedalRecentViewService } from "@/modules/osu/medal/MedalRecentView.service";

@Button(/^osu_medal_recent_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class MedalRecentPaginationComponent extends AbstractPaginationButton<
    "osu_medal_recent_view",
    MedalRecentViewDto
> {
    @Import() declare private readonly medalRecentViewService: MedalRecentViewService;

    protected readonly paginationID = "osu_medal_recent";
    protected readonly sessionKey = "osu_medal_recent_view";
    protected readonly dto = MedalRecentViewDto;

    protected get viewService(): MedalRecentViewService {
        return this.medalRecentViewService;
    }

    protected getCurrentPage(data: MedalRecentViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: MedalRecentViewDto): number {
        return data.medals.length;
    }

    protected setCurrentPage(data: MedalRecentViewDto, page: number): void {
        data.page = page;
    }

    protected getModalTitle(): string {
        return "Jump to Medal";
    }

    protected getModalLabel(): string {
        return "Medal number";
    }
}

@Modal(/^osu_medal_recent_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class MedalRecentPaginationModal extends AbstractPaginationModal<"osu_medal_recent_view", MedalRecentViewDto> {
    @Import() declare private readonly medalRecentViewService: MedalRecentViewService;

    protected readonly sessionKey = "osu_medal_recent_view";
    protected readonly dto = MedalRecentViewDto;

    protected get viewService(): MedalRecentViewService {
        return this.medalRecentViewService;
    }

    protected getCurrentPage(data: MedalRecentViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: MedalRecentViewDto): number {
        return data.medals.length;
    }

    protected setCurrentPage(data: MedalRecentViewDto, page: number): void {
        data.page = page;
    }
}
