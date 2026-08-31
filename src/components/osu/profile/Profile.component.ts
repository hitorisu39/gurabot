import { Import, SelectMenu } from "@/core/decorators";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { Embed } from "@/core/discord/ui/Embed";
import { AbstractSessionComponent } from "@/components/AbstractSessionComponent";
import { OsuService } from "@/modules/osu/Osu.service";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { PopulatedScore } from "@domain/osu/Score.dto";
import { EProfileView, ProfileViewDto } from "@domain/osu/views/Profile.view";
import { GameMode } from "@generated/adapter/types";

@SelectMenu(/^osu_profile:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class ProfileComponent extends AbstractSessionComponent<"osu_profile_view", ProfileViewDto> {
    @Import() declare private readonly profileViewService: ProfileViewService;
    @Import() declare private readonly osuService: OsuService;

    protected readonly sessionKey = "osu_profile_view";
    protected readonly dto = ProfileViewDto;

    public async execute(ctx: ComponentContext): Promise<void> {
        const { sessionID } = ctx.params;
        if (!sessionID) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const data = await this.getData(ctx, sessionID);
        if (!data.scores) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "Scores were not present during interaction.");
        }

        const view = ctx.values[0] as EProfileView;
        if (!Object.values(EProfileView).includes(view)) {
            throw new Exception(EApplicationError.INPUT_ERROR);
        }

        await ctx.deferUpdate();

        if (!data.populated && view === EProfileView.Average) {
            await this.session.bump(this.sessionKey, sessionID);

            const populated = await this.runWithLoading(
                ctx,
                () => this.osuService.populateCalculations(data.scores!, data.profile.mode),
                {
                    embeds: [Embed.general("Downloading map data... This may take up to 60 seconds.")],
                    components: [],
                },
            );

            data.populated = populated as Array<PopulatedScore<GameMode>>;

            await this.session.update(
                this.sessionKey,
                sessionID,
                { populated: data.populated },
                this.profileViewService.getTtl(),
            );
        }

        await ctx.update(this.profileViewService.build(sessionID, data, view));
    }
}
