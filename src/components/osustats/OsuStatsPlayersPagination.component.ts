import { Button, Import, Modal } from "@/core/decorators";
import { AbstractPaginationButton } from "@/components/AbstractPaginationButton";
import { AbstractPaginationModal } from "@/components/AbstractPaginationModal";
import { OsuStatsPlayersViewDto } from "@domain/osustats/views/OsuStatsPlayers.view";
import { osuStatsPlayersMaxPages, osuStatsPlayersPageSize } from "@domain/osustats/configs/OsuStats.config";
import { OsuStatsPlayersViewService } from "@/modules/osustats/OsuStatsPlayersView.service";

@Button(/^osustats_players_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OsuStatsPlayersPaginationComponent extends AbstractPaginationButton<
    "osustats_players_view",
    OsuStatsPlayersViewDto
> {
    @Import() declare private readonly osuStatsPlayersViewService: OsuStatsPlayersViewService;

    protected readonly paginationID = "osustats_players";
    protected readonly sessionKey = "osustats_players_view";
    protected readonly dto = OsuStatsPlayersViewDto;

    protected get viewService(): OsuStatsPlayersViewService {
        return this.osuStatsPlayersViewService;
    }

    protected getCurrentPage(data: OsuStatsPlayersViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: OsuStatsPlayersViewDto): number {
        return data.lastPage ?? osuStatsPlayersMaxPages;
    }

    protected calculateNewPage(action: string, data: OsuStatsPlayersViewDto, totalPages: number): number {
        /*
         * Until osu!stats tells us where the leaderboard actually
         * ends, the "last" button has nowhere reliable to jump to.
         */
        if (action === "last" && data.lastPage === undefined) {
            return data.page;
        }

        return super.calculateNewPage(action, data, totalPages);
    }

    protected async setCurrentPage(data: OsuStatsPlayersViewDto, page: number): Promise<void> {
        const currentPage = data.page;

        const players = await this.osuStatsPlayersViewService.fetchPage(data, page);
        if (!players.length) {
            /*
             * If the immediately following page is empty,
             * we now know the current page is the last one.
             */
            if (page === currentPage + 1) {
                data.lastPage = currentPage;
            }

            return;
        }

        data.page = page;
        data.players = players;

        if (players.length < osuStatsPlayersPageSize || page >= osuStatsPlayersMaxPages) {
            data.lastPage = page;
        }
    }

    protected getModalLabel(_data: OsuStatsPlayersViewDto, totalPages: number): string {
        return `Page number (1-${totalPages})`;
    }
}

@Modal(/^osustats_players_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OsuStatsPlayersPaginationModal extends AbstractPaginationModal<
    "osustats_players_view",
    OsuStatsPlayersViewDto
> {
    @Import()
    declare private readonly osuStatsPlayersViewService: OsuStatsPlayersViewService;

    protected readonly sessionKey = "osustats_players_view";
    protected readonly dto = OsuStatsPlayersViewDto;

    protected get viewService(): OsuStatsPlayersViewService {
        return this.osuStatsPlayersViewService;
    }

    protected getCurrentPage(data: OsuStatsPlayersViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: OsuStatsPlayersViewDto): number {
        return data.lastPage ?? osuStatsPlayersMaxPages;
    }

    protected async setCurrentPage(data: OsuStatsPlayersViewDto, page: number): Promise<void> {
        const currentPage = data.page;
        const players = await this.osuStatsPlayersViewService.fetchPage(data, page);

        if (!players.length) {
            if (page === currentPage + 1) {
                data.lastPage = currentPage;
            }

            return;
        }

        data.page = page;
        data.players = players;

        if (players.length < osuStatsPlayersPageSize || page >= osuStatsPlayersMaxPages) {
            data.lastPage = page;
        }
    }
}
