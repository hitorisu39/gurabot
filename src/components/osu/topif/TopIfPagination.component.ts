import { Button, Import, Modal } from "@/core/decorators";
import { AbstractPaginationButton } from "@/components/AbstractPaginationButton";
import { AbstractPaginationModal } from "@/components/AbstractPaginationModal";
import { TopIfViewDto } from "@domain/osu/views/TopIf.view";
import { TopIfViewService } from "@/modules/osu/topif/TopIfView.service";

@Button(/^osu_topif_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class TopIfPaginationComponent extends AbstractPaginationButton<"osu_topif_view", TopIfViewDto> {
    @Import() declare private readonly topIfViewService: TopIfViewService;

    protected readonly paginationID = "osu_topif";
    protected readonly sessionKey = "osu_topif_view";
    protected readonly dto = TopIfViewDto;

    protected get viewService(): TopIfViewService {
        return this.topIfViewService;
    }

    protected getCurrentPage(data: TopIfViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: TopIfViewDto): number {
        const pageSize = this.topIfViewService.getPageSize();
        return Math.ceil(data.scores.length / pageSize) || 1;
    }

    protected setCurrentPage(data: TopIfViewDto, page: number): void {
        data.page = page;
    }

    protected async preparePage(data: TopIfViewDto): Promise<void> {
        await this.topIfViewService.populatePage(data.scores, data.page, data);
    }
}

@Modal(/^osu_topif_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class TopIfPaginationModal extends AbstractPaginationModal<"osu_topif_view", TopIfViewDto> {
    @Import() declare private readonly topIfViewService: TopIfViewService;

    protected readonly sessionKey = "osu_topif_view";
    protected readonly dto = TopIfViewDto;

    protected get viewService(): TopIfViewService {
        return this.topIfViewService;
    }

    protected getCurrentPage(data: TopIfViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: TopIfViewDto): number {
        const pageSize = this.topIfViewService.getPageSize();
        return Math.ceil(data.scores.length / pageSize) || 1;
    }

    protected setCurrentPage(data: TopIfViewDto, page: number): void {
        data.page = page;
    }

    protected async preparePage(data: TopIfViewDto): Promise<void> {
        await this.topIfViewService.populatePage(data.scores, data.page, data);
    }
}
