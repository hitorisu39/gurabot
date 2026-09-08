import { Import, Subcommand } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractOsuCommand } from "@/commands/osu/AbstractOsuCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { OtrService } from "@/modules/otr/api/Otr.service";
import { AdapterProvider } from "@generated/adapter/types";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { OtrHistoryGraphService } from "@/modules/otr/views/OtrHistoryGraph.service";
import { OtrHistoryViewService } from "@/modules/otr/views/OtrHistoryView.service";

@Subcommand({
    root: "otr",
    name: "history",
    description: "Shows the tournament rating history of an osu! player.",
})
export class OtrHistorySubcommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly otrService: OtrService;
    @Import() declare private readonly historyGraphService: OtrHistoryGraphService;
    @Import() declare private readonly historyViewService: OtrHistoryViewService;

    protected forcedServer = AdapterProvider.Bancho;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const cachedID = await this.osuService.resolveCachedID(target.query, AdapterProvider.Bancho);

        let profile, stats;

        if (cachedID) {
            [profile, stats] = await Promise.all([
                this.osuService.user(cachedID, target.mode, AdapterProvider.Bancho),
                this.otrService.playerStats(cachedID, { mode: target.mode }),
            ]);
        } else {
            profile = await this.osuService.user(target.query, target.mode, AdapterProvider.Bancho);
            stats = await this.otrService.playerStats(profile.id, { mode: profile.mode });
        }

        const adjustments = stats.rating?.adjustments ?? [];
        if (!adjustments.length) {
            throw new Exception(EApplicationError.NOT_FOUND, "This player has no o!TR rating history.");
        }

        const graph = await this.historyGraphService.generate(adjustments);
        await ctx.respond(this.historyViewService.build(profile, stats, graph));
    }
}
