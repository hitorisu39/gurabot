import { Button, Import, Modal } from "@/core/decorators";
import { AbstractPaginationButton } from "@/components/AbstractPaginationButton";
import { AbstractPaginationModal } from "@/components/AbstractPaginationModal";
import { NoChokeViewDto } from "@domain/osu/views/NoChoke.view";
import { NoChokeViewService } from "@/modules/osu/nochoke/NoChokeView.service";

@Button(/^osu_nochoke_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class NoChokePaginationComponent extends AbstractPaginationButton<"osu_nochoke_view", NoChokeViewDto> {
    @Import() declare private readonly noChokeViewService: NoChokeViewService;

    protected readonly paginationID = "osu_nochoke";
    protected readonly sessionKey = "osu_nochoke_view";
    protected readonly dto = NoChokeViewDto;

    protected get viewService(): NoChokeViewService {
        return this.noChokeViewService;
    }

    protected getCurrentPage(data: NoChokeViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: NoChokeViewDto): number {
        const pageSize = this.noChokeViewService.getPageSize();

        return Math.ceil(data.scores.length / pageSize) || 1;
    }

    protected setCurrentPage(data: NoChokeViewDto, page: number): void {
        data.page = page;
    }

    protected async preparePage(data: NoChokeViewDto): Promise<void> {
        await this.noChokeViewService.populatePage(data.scores, data.page, data);
    }
}

@Modal(/^osu_nochoke_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class NoChokePaginationModal extends AbstractPaginationModal<"osu_nochoke_view", NoChokeViewDto> {
    @Import() declare private readonly noChokeViewService: NoChokeViewService;

    protected readonly sessionKey = "osu_nochoke_view";
    protected readonly dto = NoChokeViewDto;

    protected get viewService(): NoChokeViewService {
        return this.noChokeViewService;
    }

    protected getCurrentPage(data: NoChokeViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: NoChokeViewDto): number {
        const pageSize = this.noChokeViewService.getPageSize();
        return Math.ceil(data.scores.length / pageSize) || 1;
    }

    protected setCurrentPage(data: NoChokeViewDto, page: number): void {
        data.page = page;
    }

    protected async preparePage(data: NoChokeViewDto): Promise<void> {
        await this.noChokeViewService.populatePage(data.scores, data.page, data);
    }
}
