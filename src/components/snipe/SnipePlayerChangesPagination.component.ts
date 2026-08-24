import { Button, Import, Modal } from "@/core/decorators";
import { SnipePlayerChangesViewDto } from "@domain/snipe/views/SnipePlayerChanges.view";
import { AbstractPaginationButton } from "../AbstractPaginationButton";
import { SnipePlayerChangesViewService } from "@/modules/snipe/SnipePlayerChangesView.service";
import { snipePlayerChangesPageSize } from "@domain/snipe/configs/Snipe.config";
import { AbstractPaginationModal } from "../AbstractPaginationModal";

@Button(/^snipe_player_changes_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class SnipePlayerChangesPaginationComponent extends AbstractPaginationButton<
    "snipe_player_changes_view",
    SnipePlayerChangesViewDto
> {
    @Import() declare private readonly snipePlayerChangesViewService: SnipePlayerChangesViewService;

    protected readonly paginationID = "snipe_player_changes";
    protected readonly sessionKey = "snipe_player_changes_view";
    protected readonly dto = SnipePlayerChangesViewDto;

    protected get viewService(): SnipePlayerChangesViewService {
        return this.snipePlayerChangesViewService;
    }

    protected getCurrentPage(data: SnipePlayerChangesViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: SnipePlayerChangesViewDto): number {
        return Math.max(1, Math.ceil(data.changes.length / snipePlayerChangesPageSize));
    }

    protected setCurrentPage(data: SnipePlayerChangesViewDto, page: number): void {
        data.page = page;
    }

    protected getModalTitle(): string {
        return "Jump to Snipe Page";
    }
}

@Modal(/^snipe_player_changes_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class SnipePlayerChangesPaginationModal extends AbstractPaginationModal<
    "snipe_player_changes_view",
    SnipePlayerChangesViewDto
> {
    @Import() declare private readonly snipePlayerChangesViewService: SnipePlayerChangesViewService;

    protected readonly sessionKey = "snipe_player_changes_view";
    protected readonly dto = SnipePlayerChangesViewDto;

    protected get viewService(): SnipePlayerChangesViewService {
        return this.snipePlayerChangesViewService;
    }

    protected getCurrentPage(data: SnipePlayerChangesViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: SnipePlayerChangesViewDto): number {
        return Math.max(1, Math.ceil(data.changes.length / snipePlayerChangesPageSize));
    }

    protected setCurrentPage(data: SnipePlayerChangesViewDto, page: number): void {
        data.page = page;
    }
}
