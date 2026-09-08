import { Import } from "@/core/decorators";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { EOtrMapView, OtrMapViewDto } from "@domain/otr/views/OtrMap.view";
import { OtrMapViewService } from "./OtrMapView.service";
import { TMessagePayload } from "@/core/discord/context/CommandContext";

export class OtrMapLeaderboardViewService extends AbstractViewService<OtrMapViewDto> {
    @Import() declare private readonly mapViewService: OtrMapViewService;

    protected readonly ttl = 180;

    public build(sessionID: string, data: OtrMapViewDto): Promise<TMessagePayload> {
        return this.mapViewService.build(sessionID, data, EOtrMapView.Leaderboard);
    }
}
