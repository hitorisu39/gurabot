import { Button, Import, Modal } from "@/core/decorators";
import { AbstractPaginationButton } from "@/components/AbstractPaginationButton";
import { AbstractPaginationModal } from "@/components/AbstractPaginationModal";
import { MedalMissingViewDto } from "@domain/osu/views/MedalMissing.view";
import { MedalMissingViewService } from "@/modules/osu/medal/MedalMissingView.service";

@Button(/^osu_medal_missing_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class MedalMissingPaginationComponent extends AbstractPaginationButton<
    "osu_medal_missing_view",
    MedalMissingViewDto
> {
    @Import() declare private readonly medalMissingViewService: MedalMissingViewService;

    protected readonly paginationID = "osu_medal_missing";
    protected readonly sessionKey = "osu_medal_missing_view";
    protected readonly dto = MedalMissingViewDto;

    protected get viewService(): MedalMissingViewService {
        return this.medalMissingViewService;
    }

    protected getCurrentPage(data: MedalMissingViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: MedalMissingViewDto): number {
        const pageSize = this.medalMissingViewService.getPageSize();

        return Math.ceil(data.medals.length / pageSize) || 1;
    }

    protected setCurrentPage(data: MedalMissingViewDto, page: number): void {
        data.page = page;
    }
}

@Modal(/^osu_medal_missing_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class MedalMissingPaginationModal extends AbstractPaginationModal<
    "osu_medal_missing_view",
    MedalMissingViewDto
> {
    @Import() declare private readonly medalMissingViewService: MedalMissingViewService;

    protected readonly sessionKey = "osu_medal_missing_view";
    protected readonly dto = MedalMissingViewDto;

    protected get viewService(): MedalMissingViewService {
        return this.medalMissingViewService;
    }

    protected getCurrentPage(data: MedalMissingViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: MedalMissingViewDto): number {
        const pageSize = this.medalMissingViewService.getPageSize();

        return Math.ceil(data.medals.length / pageSize) || 1;
    }

    protected setCurrentPage(data: MedalMissingViewDto, page: number): void {
        data.page = page;
    }
}
