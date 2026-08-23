import { Button, Import, Modal } from "@/core/decorators";
import { AbstractPaginationButton } from "@/components/AbstractPaginationButton";
import { AbstractPaginationModal } from "@/components/AbstractPaginationModal";
import { MostPlayedViewDto } from "@domain/osu/views/MostPlayed.view";
import { MostPlayedViewService } from "@/modules/osu/mostplayed/MostPlayedView.service";

@Button(/^osu_most_played_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class MostPlayedPaginationComponent extends AbstractPaginationButton<"osu_most_played_view", MostPlayedViewDto> {
    @Import() declare private readonly mostPlayedViewService: MostPlayedViewService;

    protected readonly paginationID = "osu_most_played";
    protected readonly sessionKey = "osu_most_played_view";
    protected readonly dto = MostPlayedViewDto;

    protected get viewService(): MostPlayedViewService {
        return this.mostPlayedViewService;
    }

    protected getCurrentPage(data: MostPlayedViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: MostPlayedViewDto): number {
        return Math.ceil(data.beatmaps.length / this.viewService.getPageSize()) || 1;
    }

    protected setCurrentPage(data: MostPlayedViewDto, page: number): void {
        data.page = page;
    }
}

@Modal(/^osu_most_played_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class MostPlayedPaginationModal extends AbstractPaginationModal<"osu_most_played_view", MostPlayedViewDto> {
    @Import() declare private readonly mostPlayedViewService: MostPlayedViewService;

    protected readonly sessionKey = "osu_most_played_view";
    protected readonly dto = MostPlayedViewDto;

    protected get viewService(): MostPlayedViewService {
        return this.mostPlayedViewService;
    }

    protected getCurrentPage(data: MostPlayedViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: MostPlayedViewDto): number {
        return Math.ceil(data.beatmaps.length / this.viewService.getPageSize()) || 1;
    }

    protected setCurrentPage(data: MostPlayedViewDto, page: number): void {
        data.page = page;
    }
}
