import { Import, SelectMenu } from "@/core/decorators";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { AbstractSessionComponent } from "@/components/AbstractSessionComponent";
import { OtrMapViewService } from "@/modules/otr/views/OtrMapView.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { EOtrMapView, OtrMapViewDto } from "@domain/otr/views/OtrMap.view";

@SelectMenu(/^otr_map:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OtrMapComponent extends AbstractSessionComponent<"otr_map_view", OtrMapViewDto> {
    @Import() declare private readonly mapViewService: OtrMapViewService;

    protected readonly sessionKey = "otr_map_view";
    protected readonly dto = OtrMapViewDto;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;
        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = await this.getData(ctx, sessionID);
        const view = ctx.values[0] as EOtrMapView;

        if (!Object.values(EOtrMapView).includes(view)) {
            throw new Exception(EApplicationError.INPUT_ERROR);
        }

        await ctx.deferUpdate();
        await ctx.update(await this.mapViewService.build(sessionID, data, view));
    }
}
