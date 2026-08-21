import { Button, Import, Modal } from "@/core/decorators";
import { MedalListViewDto } from "@domain/osu/views/MedalList.view";
import { MedalListViewService } from "@/modules/osu/medal/MedalListView.service";
import { AbstractPaginationButton } from "@/components/AbstractPaginationButton";
import { AbstractPaginationModal } from "@/components/AbstractPaginationModal";

@Button(/^osu_medal_list_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class MedalListPaginationComponent extends AbstractPaginationButton<"osu_medal_list_view", MedalListViewDto> {
    @Import() declare private readonly medalListViewService: MedalListViewService;

    protected readonly paginationID = "osu_medal_list";
    protected readonly sessionKey = "osu_medal_list_view";
    protected readonly dto = MedalListViewDto;

    protected get viewService(): MedalListViewService {
        return this.medalListViewService;
    }

    protected getCurrentPage(data: MedalListViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: MedalListViewDto): number {
        const pageSize = this.medalListViewService.getPageSize();

        return Math.ceil(data.medals.length / pageSize) || 1;
    }

    protected setCurrentPage(data: MedalListViewDto, page: number): void {
        data.page = page;
    }
}

@Modal(/^osu_medal_list_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class MedalListPaginationModal extends AbstractPaginationModal<"osu_medal_list_view", MedalListViewDto> {
    @Import() declare private readonly medalListViewService: MedalListViewService;

    protected readonly sessionKey = "osu_medal_list_view";
    protected readonly dto = MedalListViewDto;

    protected get viewService(): MedalListViewService {
        return this.medalListViewService;
    }

    protected getCurrentPage(data: MedalListViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: MedalListViewDto): number {
        const pageSize = this.medalListViewService.getPageSize();

        return Math.ceil(data.medals.length / pageSize) || 1;
    }

    protected setCurrentPage(data: MedalListViewDto, page: number): void {
        data.page = page;
    }
}
