import { Import, Subcommand } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { OsuService } from "@/modules/osu/Osu.service";
import { OtrService } from "@/modules/otr/api/Otr.service";
import { AbstractOsuCommand } from "@/commands/osu/AbstractOsuCommand";
import { AdapterProvider } from "@generated/adapter/types";
import { PopulatedUser } from "@domain/osu/Profile.dto";
import { OtrPlayerStatsDto } from "@domain/otr/OtrPlayer.dto";
import { EOtrScoutView, OtrScoutViewDto } from "@domain/otr/views/OtrScout.view";
import { OtrScoutViewService } from "@/modules/otr/views/OtrScoutView.service";

@Subcommand({
    root: "otr",
    name: "scout",
    description: "Scouts the recent tournament performance of an osu! player.",
})
export class OtrScoutSubcommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly otrService: OtrService;
    @Import() declare private readonly otrScoutViewService: OtrScoutViewService;

    protected forcedServer = AdapterProvider.Bancho;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const cachedID = await this.osuService.resolveCachedID(target.query, AdapterProvider.Bancho);

        let profile: PopulatedUser;
        let stats: OtrPlayerStatsDto;

        if (cachedID) {
            [profile, stats] = await Promise.all([
                this.osuService.user(cachedID, target.mode, AdapterProvider.Bancho),
                this.otrService.playerStats(cachedID, {
                    mode: target.mode,
                }),
            ]);
        } else {
            profile = await this.osuService.user(target.query, target.mode, AdapterProvider.Bancho);
            stats = await this.otrService.playerStats(profile.id, {
                mode: profile.mode,
            });
        }

        const data: OtrScoutViewDto = {
            timestamp: Date.now(),
            authorID: ctx.author.id,
            profile,
            stats,

            matches: null,
            events: null,

            selectedMatchID: null,
        };

        await this.respondWithSession(ctx, "otr_scout_view", data, this.otrScoutViewService, EOtrScoutView.Overview);
    }
}
