import { Import, SelectMenu } from "@/core/decorators";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { AbstractSessionComponent } from "@/components/AbstractSessionComponent";
import { OtrService } from "@/modules/otr/api/Otr.service";
import { OtrProfileViewService } from "@/modules/otr/views/OtrProfileView.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { otrFormDateMin } from "@domain/otr/configs/OtrProfile.config";
import { EOtrFormPeriod, EOtrProfileView, OtrProfileViewDto } from "@domain/otr/views/OtrProfile.view";

@SelectMenu(/^otr_profile_form:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class OtrProfileFormComponent extends AbstractSessionComponent<"otr_profile_view", OtrProfileViewDto> {
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
        const period = ctx.values[0] as EOtrFormPeriod;

        if (!Object.values(EOtrFormPeriod).includes(period)) {
            throw new Exception(EApplicationError.INPUT_ERROR);
        }

        await ctx.deferUpdate();
        await this.session.bump(this.sessionKey, sessionID);

        const formStats =
            period === EOtrFormPeriod.All
                ? data.stats
                : await this.otrService.playerStats(data.profile.id, {
                      mode: data.profile.mode,
                      dateMin: otrFormDateMin(period),
                  });

        data.formPeriod = period;
        data.formStats = formStats;

        await this.session.update(
            this.sessionKey,
            sessionID,
            { formPeriod: period, formStats },
            this.profileViewService.getTtl(),
        );

        await ctx.update(this.profileViewService.build(sessionID, data, EOtrProfileView.Form));
    }
}
