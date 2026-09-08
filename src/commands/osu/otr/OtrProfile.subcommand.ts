import { Import, Subcommand } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { OsuService } from "@/modules/osu/Osu.service";
import { OtrService } from "@/modules/otr/api/Otr.service";
import { AbstractOsuCommand } from "@/commands/osu/AbstractOsuCommand";
import { AdapterProvider } from "@generated/adapter/types";
import { PopulatedUser } from "@domain/osu/Profile.dto";
import { OtrPlayerStatsDto } from "@domain/otr/OtrPlayer.dto";
import { EOtrFormPeriod, EOtrProfileView, OtrProfileViewDto } from "@domain/otr/views/OtrProfile.view";
import { OtrProfileViewService } from "@/modules/otr/views/OtrProfileView.service";

@Subcommand({
    root: "otr",
    name: "profile",
    description: "Shows the tournament rating profile of an osu! player.",
})
export class OtrProfileSubcommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly otrService: OtrService;
    @Import() declare private readonly profileViewService: OtrProfileViewService;

    protected forcedServer = AdapterProvider.Bancho;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const cachedID = await this.osuService.resolveCachedID(target.query, AdapterProvider.Bancho);

        let profile: PopulatedUser;
        let stats: OtrPlayerStatsDto;

        if (cachedID) {
            [profile, stats] = await Promise.all([
                this.osuService.user(cachedID, target.mode, AdapterProvider.Bancho),
                this.otrService.playerStats(cachedID, { mode: target.mode }),
            ]);
        } else {
            profile = await this.osuService.user(target.query, target.mode, AdapterProvider.Bancho);
            stats = await this.otrService.playerStats(profile.id, { mode: profile.mode });
        }

        const data: OtrProfileViewDto = {
            timestamp: Date.now(),
            authorID: ctx.author.id,
            profile,
            stats,
            formStats: null,
            formPeriod: EOtrFormPeriod.Days90,
            tournaments: null,
        };

        await this.respondWithSession(ctx, "otr_profile_view", data, this.profileViewService, EOtrProfileView.Overview);
    }
}
