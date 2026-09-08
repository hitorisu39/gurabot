import { Import, SelectMenu } from "@/core/decorators";
import { EOtrScoutView, OtrScoutViewDto } from "@domain/otr/views/OtrScout.view";
import { AbstractSessionComponent } from "../AbstractSessionComponent";
import { OtrScoutViewService } from "@/modules/otr/views/OtrScoutView.service";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { isValidNumber } from "@domain/utils/utils";

@SelectMenu(/^otr_scout_match:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OtrScoutMatchComponent extends AbstractSessionComponent<"otr_scout_view", OtrScoutViewDto> {
    @Import() declare private readonly scoutViewService: OtrScoutViewService;

    protected readonly sessionKey = "otr_scout_view";
    protected readonly dto = OtrScoutViewDto;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;
        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = await this.getData(ctx, sessionID);
        const matchID = Number(ctx.values[0]);

        if (!isValidNumber(matchID) || !data.matches?.some((match) => match.id === matchID)) {
            throw new Exception(EApplicationError.INPUT_ERROR);
        }

        await ctx.deferUpdate();

        data.selectedMatchID = matchID;

        await this.session.update(
            this.sessionKey,
            sessionID,
            { selectedMatchID: matchID },
            this.scoutViewService.getTtl(),
        );

        await ctx.update(this.scoutViewService.build(sessionID, data, EOtrScoutView.Matches));
    }
}
