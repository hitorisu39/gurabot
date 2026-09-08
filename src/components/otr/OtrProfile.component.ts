import { Import, SelectMenu } from "@/core/decorators";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { AbstractSessionComponent } from "@/components/AbstractSessionComponent";
import { OtrService } from "@/modules/otr/api/Otr.service";
import { OtrProfileViewService } from "@/modules/otr/views/OtrProfileView.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { EOtrProfileView, OtrProfileViewDto } from "@domain/otr/views/OtrProfile.view";
import { otrFormDateMin } from "@domain/otr/configs/OtrProfile.config";

@SelectMenu(/^otr_profile:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OtrProfileComponent extends AbstractSessionComponent<"otr_profile_view", OtrProfileViewDto> {
    @Import() declare private readonly otrService: OtrService;
    @Import() declare private readonly profileViewService: OtrProfileViewService;

    protected readonly sessionKey = "otr_profile_view";
    protected readonly dto = OtrProfileViewDto;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;

        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = await this.getData(ctx, sessionID);
        const view = ctx.values[0] as EOtrProfileView;

        if (!Object.values(EOtrProfileView).includes(view)) {
            throw new Exception(EApplicationError.INPUT_ERROR);
        }

        await ctx.deferUpdate();

        if (view === EOtrProfileView.Tournaments && !data.tournaments) {
            await this.session.bump(this.sessionKey, sessionID);

            data.tournaments = await this.otrService.playerTournaments(data.profile.id, {
                mode: data.profile.mode,
            });

            await this.session.update(
                this.sessionKey,
                sessionID,
                { tournaments: data.tournaments },
                this.profileViewService.getTtl(),
            );
        }

        if (view === EOtrProfileView.Form && !data.formStats) {
            data.formStats = await this.otrService.playerStats(data.profile.id, {
                mode: data.profile.mode,
                dateMin: otrFormDateMin(data.formPeriod),
            });

            await this.session.update(
                this.sessionKey,
                sessionID,
                { formStats: data.formStats },
                this.profileViewService.getTtl(),
            );
        }

        await ctx.update(this.profileViewService.build(sessionID, data, view));
    }
}
