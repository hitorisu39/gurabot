import { EApplicationError, Exception } from "@domain/core/Exception";
import { Import, SelectMenu } from "@/core/decorators";
import { AbstractComponent } from "@/core/discord/AbstractComponent";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { Embed } from "@/core/discord/ui/Embed";
import { SessionService } from "@/modules/cache/Session.service";
import { OsuService } from "@/modules/osu/Osu.service";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { PopulatedScore } from "@domain/osu/Score.dto";
import { EProfileView, ProfileViewDto } from "@domain/osu/views/Profile.view";
import { GameMode } from "@generated/adapter/types";
import { plainToInstance } from "class-transformer";

@SelectMenu(/^osu_profile:(?<sessionID>[a-zA-Z0-9_-]+)$/)
export class ProfileComponent extends AbstractComponent {
    @Import() declare private readonly sessionSerice: SessionService;
    @Import() declare private readonly profileViewService: ProfileViewService;
    @Import() declare private readonly osuService: OsuService;

    public async execute(ctx: ComponentContext): Promise<void> {
        const sessionID = ctx.params.sessionID;
        if (!sessionID) throw new Exception(EApplicationError.SESSION_EXPIRED);

        const plain = await this.sessionSerice.get("osu_profile_view", sessionID);
        if (!plain) throw new Exception(EApplicationError.SESSION_EXPIRED);
        const data = plainToInstance(ProfileViewDto, plain);

        if (data.authorID !== ctx.author.id) throw new Exception(EApplicationError.ACCESS_ERROR);
        await ctx.deferUpdate();

        if (!data.scores)
            throw new Exception(EApplicationError.INTERNAL_ERROR, `Scores were not present during interaction.`);

        const view = ctx.values[0] as EProfileView;

        if (!data.populated && view === EProfileView.Average) {
            await this.sessionSerice.bump("osu_profile_view", sessionID);

            const populated = await this.runWithLoading(
                ctx,
                () => this.osuService.populateCalculations(data.scores!, data.profile.mode),
                { embeds: [Embed.general("Downloading map data... This may take up to 60 seconds.")], components: [] },
            );
            data.populated = populated as Array<PopulatedScore<GameMode>>;

            await this.sessionSerice.update(
                "osu_profile_view",
                sessionID,
                { populated: data.populated },
                this.profileViewService.getTtl(),
            );
        }

        await ctx.update(this.profileViewService.build(sessionID, data, view));
    }
}
