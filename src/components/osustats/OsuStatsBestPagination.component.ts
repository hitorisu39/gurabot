import { Button, Import, Modal } from "@/core/decorators";
import { AbstractPaginationButton } from "@/components/AbstractPaginationButton";
import { AbstractPaginationModal } from "@/components/AbstractPaginationModal";
import { OsuStatsBestViewDto } from "@domain/osustats/views/OsuStatsBest.view";
import { osuStatsBestPageSize } from "@domain/osustats/configs/OsuStatsBest.config";
import { OsuStatsBestViewService } from "@/modules/osustats/OsuStatsBestView.service";

@Button(/^osustats_best_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OsuStatsBestPaginationComponent extends AbstractPaginationButton<
    "osustats_best_view",
    OsuStatsBestViewDto
> {
    @Import() declare private readonly osuStatsBestViewService: OsuStatsBestViewService;

    protected readonly paginationID = "osustats_best";
    protected readonly sessionKey = "osustats_best_view";
    protected readonly dto = OsuStatsBestViewDto;

    protected get viewService(): OsuStatsBestViewService {
        return this.osuStatsBestViewService;
    }

    protected getCurrentPage(data: OsuStatsBestViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: OsuStatsBestViewDto): number {
        return Math.ceil(data.scores.length / osuStatsBestPageSize) || 1;
    }

    protected setCurrentPage(data: OsuStatsBestViewDto, page: number): void {
        data.page = page;
    }
}

@Modal(/^osustats_best_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OsuStatsBestPaginationModal extends AbstractPaginationModal<"osustats_best_view", OsuStatsBestViewDto> {
    @Import() declare private readonly osuStatsBestViewService: OsuStatsBestViewService;

    protected readonly sessionKey = "osustats_best_view";
    protected readonly dto = OsuStatsBestViewDto;

    protected get viewService(): OsuStatsBestViewService {
        return this.osuStatsBestViewService;
    }

    protected getCurrentPage(data: OsuStatsBestViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: OsuStatsBestViewDto): number {
        return Math.ceil(data.scores.length / osuStatsBestPageSize) || 1;
    }

    protected setCurrentPage(data: OsuStatsBestViewDto, page: number): void {
        data.page = page;
    }
}
