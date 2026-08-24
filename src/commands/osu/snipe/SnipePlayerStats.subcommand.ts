import { Import, Subcommand } from "@/core/decorators";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { OsuService } from "@/modules/osu/Osu.service";
import { SnipePlayerStatsViewService } from "@/modules/snipe/SnipePlayerStatsView.service";
import { SnipeService } from "@/modules/snipe/Snipe.service";
import { EApplicationError, Exception } from "@domain/core/Exception";

@Subcommand({
    root: "snipe",
    group: "player",
    name: "stats",
    description: "Shows a player's national #1 statistics.",
})
export class SnipePlayerStatsSubcommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly snipeService: SnipeService;
    @Import() declare private readonly snipePlayerStatsViewService: SnipePlayerStatsViewService;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const profile = await this.osuService.user(target.query, target.mode);

        const [player, history] = await Promise.all([
            this.snipeService.player(profile.id, profile.countryCode),
            this.snipeService.playerHistory(profile.id, profile.countryCode),
        ]);

        if (!player) {
            throw new Exception(EApplicationError.NOT_FOUND, `${profile.username} does not have any national #1s.`);
        }

        await ctx.respond(
            await this.snipePlayerStatsViewService.build({
                profile,
                player,
                history,
            }),
        );
    }
}
