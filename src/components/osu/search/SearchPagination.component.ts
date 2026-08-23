import { Button, Import } from "@/core/decorators";
import { AbstractPaginationButton } from "@/components/AbstractPaginationButton";
import { SearchViewDto } from "@domain/osu/views/Search.view";
import { SearchViewService } from "@/modules/osu/search/SearchView.service";
import { mapsetSearchPageSize } from "@domain/osu/configs/Beatmap.config";

@Button(/^osu_search_(?<action>first|prev|next):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class SearchPaginationComponent extends AbstractPaginationButton<"osu_search_view", SearchViewDto> {
    @Import() declare private readonly searchViewService: SearchViewService;

    protected readonly paginationID = "osu_search";
    protected readonly sessionKey = "osu_search_view";
    protected readonly dto = SearchViewDto;

    protected get viewService(): SearchViewService {
        return this.searchViewService;
    }

    protected getCurrentPage(data: SearchViewDto): number {
        return data.page;
    }

    protected getTotalPages(data: SearchViewDto): number {
        return Math.max(1, Math.ceil(data.total / mapsetSearchPageSize));
    }

    protected setCurrentPage(data: SearchViewDto, page: number): void {
        data.page = page;
    }

    protected async preparePage(data: SearchViewDto): Promise<void> {
        await this.searchViewService.prepare(data);
    }
}
