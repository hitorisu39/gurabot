import { Button, Import, Modal } from "@/core/decorators";
import { AbstractPaginationButton } from "@/components/AbstractPaginationButton";
import { AbstractPaginationModal } from "@/components/AbstractPaginationModal";
import { OtrMapViewDto } from "@domain/otr/views/OtrMap.view";
import { otrMapTournamentsPageSize } from "@domain/otr/configs/OtrMap.config";
import { OtrMapTournamentsViewService } from "@/modules/otr/views/OtrMapTournamentsView.service";

@Button(/^otr_map_tournaments_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OtrMapTournamentsPaginationComponent extends AbstractPaginationButton<"otr_map_view", OtrMapViewDto> {
    @Import() declare private readonly mapTournamentsViewService: OtrMapTournamentsViewService;

    protected readonly paginationID = "otr_map_tournaments";
    protected readonly sessionKey = "otr_map_view";
    protected readonly dto = OtrMapViewDto;

    protected get viewService(): OtrMapTournamentsViewService {
        return this.mapTournamentsViewService;
    }

    protected getCurrentPage(data: OtrMapViewDto): number {
        return data.tournamentsPage;
    }

    protected getTotalPages(data: OtrMapViewDto): number {
        return Math.ceil(data.stats.tournaments.length / otrMapTournamentsPageSize);
    }

    protected setCurrentPage(data: OtrMapViewDto, page: number): void {
        data.tournamentsPage = page;
    }

    protected getModalTitle(): string {
        return "Jump to Tournaments Page";
    }

    protected getModalLabel(_data: OtrMapViewDto, totalPages: number): string {
        return `Page (1-${totalPages})`;
    }
}

@Modal(/^otr_map_tournaments_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OtrMapTournamentsPaginationModal extends AbstractPaginationModal<"otr_map_view", OtrMapViewDto> {
    @Import() declare private readonly mapTournamentsViewService: OtrMapTournamentsViewService;

    protected readonly sessionKey = "otr_map_view";
    protected readonly dto = OtrMapViewDto;

    protected get viewService(): OtrMapTournamentsViewService {
        return this.mapTournamentsViewService;
    }

    protected getCurrentPage(data: OtrMapViewDto): number {
        return data.tournamentsPage;
    }

    protected getTotalPages(data: OtrMapViewDto): number {
        return Math.ceil(data.stats.tournaments.length / otrMapTournamentsPageSize);
    }

    protected setCurrentPage(data: OtrMapViewDto, page: number): void {
        data.tournamentsPage = page;
    }
}
