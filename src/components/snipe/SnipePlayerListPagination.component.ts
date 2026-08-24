import { Button, Import, Modal } from "@/core/decorators";
import { SnipePlayerListViewDto } from "@domain/snipe/views/SnipePlayerList.view";
import { AbstractPaginationButton } from "../AbstractPaginationButton";
import { SnipePlayerListViewService } from "@/modules/snipe/SnipePlayerListView.service";
import { snipePlayerListPageSize } from "@domain/snipe/configs/Snipe.config";
import { AbstractPaginationModal } from "../AbstractPaginationModal";

@Button(/^snipe_player_list_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class SnipePlayerListPaginationComponent extends AbstractPaginationButton<
    "snipe_player_list_view",
    SnipePlayerListViewDto
> {
    @Import() declare private readonly snipePlayerListViewService: SnipePlayerListViewService;

    protected readonly paginationID = "snipe_player_list";
    protected readonly sessionKey = "snipe_player_list_view";
    protected readonly dto = SnipePlayerListViewDto;

    protected get viewService(): SnipePlayerListViewService {
        return this.snipePlayerListViewService;
    }

    protected getCurrentPage(data: SnipePlayerListViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: SnipePlayerListViewDto): number {
        return Math.max(1, Math.ceil(data.total / snipePlayerListPageSize));
    }

    protected setCurrentPage(data: SnipePlayerListViewDto, page: number): void {
        data.page = page;
    }

    protected async preparePage(data: SnipePlayerListViewDto): Promise<void> {
        await this.snipePlayerListViewService.prepare(data);
    }

    protected getModalTitle(): string {
        return "Jump to National #1 Page";
    }
}

@Modal(/^snipe_player_list_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class SnipePlayerListPaginationModal extends AbstractPaginationModal<
    "snipe_player_list_view",
    SnipePlayerListViewDto
> {
    @Import() declare private readonly snipePlayerListViewService: SnipePlayerListViewService;

    protected readonly sessionKey = "snipe_player_list_view";
    protected readonly dto = SnipePlayerListViewDto;

    protected get viewService(): SnipePlayerListViewService {
        return this.snipePlayerListViewService;
    }

    protected getCurrentPage(data: SnipePlayerListViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: SnipePlayerListViewDto): number {
        return Math.max(1, Math.ceil(data.total / snipePlayerListPageSize));
    }

    protected setCurrentPage(data: SnipePlayerListViewDto, page: number): void {
        data.page = page;
    }

    protected async preparePage(data: SnipePlayerListViewDto): Promise<void> {
        await this.snipePlayerListViewService.prepare(data);
    }
}
