import { Button, Import, Modal } from "@/core/decorators";
import { AbstractPaginationButton } from "@/components/AbstractPaginationButton";
import { AbstractPaginationModal } from "@/components/AbstractPaginationModal";
import { FarmMapsService } from "@/modules/farm/FarmMaps.service";
import { FarmMapsViewService } from "@/modules/farm/FarmMapsView.service";
import { FarmMapsViewDto } from "@domain/farm/views/FarmMaps.view";

@Button(/^farm_maps_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class FarmMapsPaginationComponent extends AbstractPaginationButton<"osu_farm_maps_view", FarmMapsViewDto> {
    @Import() declare private readonly farmMapsViewService: FarmMapsViewService;
    @Import() declare private readonly farmMapsService: FarmMapsService;

    protected readonly paginationID = "farm_maps";
    protected readonly sessionKey = "osu_farm_maps_view";
    protected readonly dto = FarmMapsViewDto;

    protected get viewService(): FarmMapsViewService {
        return this.farmMapsViewService;
    }

    protected getCurrentPage(data: FarmMapsViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: FarmMapsViewDto): number {
        return data.lastPage ?? data.page + 1;
    }

    protected setCurrentPage(data: FarmMapsViewDto, page: number): void {
        data.page = page;
    }

    protected async preparePage(data: FarmMapsViewDto): Promise<void> {
        await this.farmMapsService.populatePage(data);
    }
}

@Modal(/^farm_maps_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class FarmMapsPaginationModal extends AbstractPaginationModal<"osu_farm_maps_view", FarmMapsViewDto> {
    @Import() declare private readonly farmMapsViewService: FarmMapsViewService;
    @Import() declare private readonly farmMapsService: FarmMapsService;

    protected readonly sessionKey = "osu_farm_maps_view";
    protected readonly dto = FarmMapsViewDto;

    protected get viewService(): FarmMapsViewService {
        return this.farmMapsViewService;
    }

    protected getCurrentPage(data: FarmMapsViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: FarmMapsViewDto): number {
        return data.lastPage ?? data.page;
    }

    protected setCurrentPage(data: FarmMapsViewDto, page: number): void {
        data.page = page;
    }

    protected async preparePage(data: FarmMapsViewDto): Promise<void> {
        await this.farmMapsService.populatePage(data);
    }
}
