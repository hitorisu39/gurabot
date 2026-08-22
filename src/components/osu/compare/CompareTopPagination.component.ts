import { Button, Import, Modal } from "@/core/decorators";
import { AbstractPaginationButton } from "@/components/AbstractPaginationButton";
import { AbstractPaginationModal } from "@/components/AbstractPaginationModal";
import { CompareTopViewDto } from "@domain/osu/views/CompareTop.view";
import { CompareTopViewService } from "@/modules/osu/compare/CompareTopView.service";

@Button(/^osu_common_scores_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class CommonScoresPaginationComponent extends AbstractPaginationButton<"osu_compare_top_view", CompareTopViewDto> {
    @Import() declare private readonly compareTopViewService: CompareTopViewService;

    protected readonly paginationID = "osu_compare_top";
    protected readonly sessionKey = "osu_compare_top_view";
    protected readonly dto = CompareTopViewDto;

    protected get viewService(): CompareTopViewService {
        return this.compareTopViewService;
    }

    protected getCurrentPage(data: CompareTopViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: CompareTopViewDto): number {
        return Math.ceil(data.comparisons.length / this.viewService.getPageSize()) || 1;
    }

    protected setCurrentPage(data: CompareTopViewDto, page: number): void {
        data.page = page;
    }
}

@Modal(/^osu_common_scores_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class CommonScoresPaginationModal extends AbstractPaginationModal<"osu_compare_top_view", CompareTopViewDto> {
    @Import() declare private readonly compareTopViewService: CompareTopViewService;

    protected readonly sessionKey = "osu_compare_top_view";
    protected readonly dto = CompareTopViewDto;

    protected get viewService(): CompareTopViewService {
        return this.compareTopViewService;
    }

    protected getCurrentPage(data: CompareTopViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: CompareTopViewDto): number {
        return Math.ceil(data.comparisons.length / this.viewService.getPageSize()) || 1;
    }

    protected setCurrentPage(data: CompareTopViewDto, page: number): void {
        data.page = page;
    }
}
