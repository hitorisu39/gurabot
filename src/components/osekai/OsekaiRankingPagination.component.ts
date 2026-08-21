import { Button, Import, Modal } from "@/core/decorators";
import { AbstractPaginationButton } from "@/components/AbstractPaginationButton";
import { AbstractPaginationModal } from "@/components/AbstractPaginationModal";
import { OsekaiRankingViewDto } from "@domain/osekai/views/OsekaiRanking.view";
import { osekaiRankingPageSize } from "@domain/osekai/configs/OsekaiRanking.config";
import { OsekaiRankingViewService } from "@/modules/osekai/OsekaiRankingView.service";

@Button(/^osekai_ranking_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OsekaiRankingPaginationComponent extends AbstractPaginationButton<
    "osekai_ranking_view",
    OsekaiRankingViewDto
> {
    @Import() declare private readonly osekaiRankingViewService: OsekaiRankingViewService;

    protected readonly paginationID = "osekai_ranking";
    protected readonly sessionKey = "osekai_ranking_view";
    protected readonly dto = OsekaiRankingViewDto;

    protected get viewService(): OsekaiRankingViewService {
        return this.osekaiRankingViewService;
    }

    protected getCurrentPage(data: OsekaiRankingViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: OsekaiRankingViewDto): number {
        return Math.ceil(data.total / osekaiRankingPageSize) || 1;
    }

    protected setCurrentPage(data: OsekaiRankingViewDto, page: number): void {
        data.page = page;
    }

    protected async preparePage(data: OsekaiRankingViewDto): Promise<void> {
        await this.osekaiRankingViewService.prepare(data);
    }
}

@Modal(/^osekai_ranking_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OsekaiRankingPaginationModal extends AbstractPaginationModal<"osekai_ranking_view", OsekaiRankingViewDto> {
    @Import() declare private readonly osekaiRankingViewService: OsekaiRankingViewService;

    protected readonly sessionKey = "osekai_ranking_view";
    protected readonly dto = OsekaiRankingViewDto;

    protected get viewService(): OsekaiRankingViewService {
        return this.osekaiRankingViewService;
    }

    protected getCurrentPage(data: OsekaiRankingViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: OsekaiRankingViewDto): number {
        return Math.ceil(data.total / osekaiRankingPageSize) || 1;
    }

    protected setCurrentPage(data: OsekaiRankingViewDto, page: number): void {
        data.page = page;
    }

    protected async preparePage(data: OsekaiRankingViewDto): Promise<void> {
        await this.osekaiRankingViewService.prepare(data);
    }
}
