import { Button, Import, Modal } from "@/core/decorators";
import { BadgeViewDto } from "@domain/osu/views/Badge.view";
import { BadgeViewService } from "@/modules/osu/badge/BadgeView.service";
import { AbstractPaginationButton } from "@/components/AbstractPaginationButton";
import { AbstractPaginationModal } from "@/components/AbstractPaginationModal";

@Button(/^osu_badge_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class BadgePaginationComponent extends AbstractPaginationButton<"osu_badge_view", BadgeViewDto> {
    @Import() declare private readonly badgeViewService: BadgeViewService;

    protected readonly paginationID = "osu_badge";
    protected readonly sessionKey = "osu_badge_view";
    protected readonly dto = BadgeViewDto;

    protected get viewService(): BadgeViewService {
        return this.badgeViewService;
    }

    protected getCurrentPage(data: BadgeViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: BadgeViewDto): number {
        return data.badges.length || 1;
    }

    protected setCurrentPage(data: BadgeViewDto, page: number): void {
        data.page = page;
    }
}

@Modal(/^osu_badge_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class BadgePaginationModal extends AbstractPaginationModal<"osu_badge_view", BadgeViewDto> {
    @Import() declare private readonly badgeViewService: BadgeViewService;

    protected readonly sessionKey = "osu_badge_view";
    protected readonly dto = BadgeViewDto;

    protected get viewService(): BadgeViewService {
        return this.badgeViewService;
    }

    protected getCurrentPage(data: BadgeViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: BadgeViewDto): number {
        return data.badges.length || 1;
    }

    protected setCurrentPage(data: BadgeViewDto, page: number): void {
        data.page = page;
    }
}
