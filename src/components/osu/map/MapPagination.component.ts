import { Button, Import, Modal } from "@/core/decorators";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { MapViewDto } from "@domain/osu/views/Map.view";
import { MapViewService } from "@/modules/osu/map/MapView.service";
import { AbstractPaginationButton } from "@/components/AbstractPaginationButton";
import { AbstractPaginationModal } from "@/components/AbstractPaginationModal";

@Button(/^osu_map_(?<action>first|prev|next|last|modal):(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class MapPaginationComponent extends AbstractPaginationButton<"osu_map_view", MapViewDto> {
    @Import() declare private readonly mapViewService: MapViewService;

    protected readonly paginationID = "osu_map";
    protected readonly sessionKey = "osu_map_view";
    protected readonly dto = MapViewDto;

    protected get viewService(): MapViewService {
        return this.mapViewService;
    }

    protected getCurrentPage(data: MapViewDto): number {
        const beatmaps = [...(data.beatmapset.beatmaps ?? [])].sort((a, b) => a.difficulty - b.difficulty);
        const index = beatmaps.findIndex((beatmap) => beatmap.id === data.beatmapID);

        if (index === -1) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "Current beatmap was not found in beatmapset.");
        }

        return index + 1;
    }

    protected getTotalPages(data: MapViewDto): number {
        return data.beatmapset.beatmaps?.length ?? 0;
    }

    protected setCurrentPage(data: MapViewDto, page: number): void {
        const beatmaps = [...(data.beatmapset.beatmaps ?? [])].sort((a, b) => a.difficulty - b.difficulty);
        const beatmap = beatmaps[page - 1];

        if (!beatmap) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "Unknown beatmap index.");
        }

        data.beatmapID = beatmap.id;
    }

    protected getModalTitle(): string {
        return "Jump to Difficulty";
    }

    protected getModalLabel(_data: MapViewDto, totalPages: number): string {
        return `Difficulty Number (1-${totalPages})`;
    }
}

@Modal(/^osu_map_modal:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class MapPaginationModal extends AbstractPaginationModal<"osu_map_view", MapViewDto> {
    @Import() declare private readonly mapViewService: MapViewService;

    protected readonly sessionKey = "osu_map_view";
    protected readonly dto = MapViewDto;

    protected get viewService(): MapViewService {
        return this.mapViewService;
    }

    protected getCurrentPage(data: MapViewDto): number {
        const beatmaps = [...(data.beatmapset.beatmaps ?? [])].sort((a, b) => a.difficulty - b.difficulty);
        const index = beatmaps.findIndex((beatmap) => beatmap.id === data.beatmapID);

        if (index === -1) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "Current beatmap was not found in beatmapset.");
        }

        return index + 1;
    }

    protected getTotalPages(data: MapViewDto): number {
        return data.beatmapset.beatmaps?.length ?? 0;
    }

    protected setCurrentPage(data: MapViewDto, page: number): void {
        const beatmaps = [...(data.beatmapset.beatmaps ?? [])].sort((a, b) => a.difficulty - b.difficulty);
        const beatmap = beatmaps[page - 1];

        if (!beatmap) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "Unknown beatmap index.");
        }

        data.beatmapID = beatmap.id;
    }
}
