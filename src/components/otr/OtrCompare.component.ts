import { Import, SelectMenu } from "@/core/decorators";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { AbstractSessionComponent } from "@/components/AbstractSessionComponent";
import { OtrCompareViewService } from "@/modules/otr/views/OtrCompareView.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { EOtrCompareView, OtrCompareViewDto } from "@domain/otr/views/OtrCompare.view";

@SelectMenu(/^otr_compare:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OtrCompareComponent extends AbstractSessionComponent<"otr_compare_view", OtrCompareViewDto> {
    @Import() declare private readonly compareViewService: OtrCompareViewService;

    protected readonly sessionKey = "otr_compare_view";
    protected readonly dto = OtrCompareViewDto;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;

        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = await this.getData(ctx, sessionID);
        const view = ctx.values[0] as EOtrCompareView;

        if (!Object.values(EOtrCompareView).includes(view)) {
            throw new Exception(EApplicationError.INPUT_ERROR);
        }

        await ctx.deferUpdate();
        await ctx.update(this.compareViewService.build(sessionID, data, view));
    }
}
