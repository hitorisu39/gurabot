import { Import } from "@/core/decorators";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { OtrMapViewService } from "./OtrMapView.service";
import { EOtrMapView, OtrMapViewDto } from "@domain/otr/views/OtrMap.view";

export class OtrMapTournamentsViewService extends AbstractViewService<OtrMapViewDto> {
    @Import() declare private readonly otrMapViewService: OtrMapViewService;

    protected readonly ttl = 180;

    public build(sessionID: string, data: OtrMapViewDto): Promise<TMessagePayload> {
        return this.otrMapViewService.build(sessionID, data, EOtrMapView.Tournaments);
    }
}
