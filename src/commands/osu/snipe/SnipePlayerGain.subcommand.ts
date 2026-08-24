import { Import, IsInteger, Option, Subcommand } from "@/core/decorators";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { OsuService } from "@/modules/osu/Osu.service";
import { SnipeService } from "@/modules/snipe/Snipe.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ESnipePlayerChangeType } from "@domain/snipe/enums/Snipe.enum";
import { SnipePlayerChangesViewDto } from "@domain/snipe/views/SnipePlayerChanges.view";
import { SnipePlayerChangesViewService } from "@/modules/snipe/SnipePlayerChangesView.service";
import { CommandOption } from "@domain/core/Command";

@Subcommand({
    root: "snipe",
    group: "player",
    name: "gain",
    description: "Shows a player's recently gained national #1s.",
})
export class SnipePlayerGainSubcommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly snipeService: SnipeService;
    @Import() declare private readonly snipePlayerChangesViewService: SnipePlayerChangesViewService;

    @Option("days", "How many days of recent gains to show.")
    @IsInteger(1, 90)
    declare private readonly days: CommandOption<number>;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const profile = await this.osuService.user(target.query, target.mode);

        const days = this.days.unwrapOr(7);

        const until = new Date();
        const since = new Date(until);
        since.setUTCDate(since.getUTCDate() - days);

        const result = await this.snipeService.playerChanges(profile.id, ESnipePlayerChangeType.Gain, since, until);

        if (!result.changes.length) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                `${profile.username} has not gained any national #1s in the last ${days} days.`,
            );
        }

        const data: SnipePlayerChangesViewDto = {
            timestamp: Date.now(),
            authorID: ctx.author.id,
            type: ESnipePlayerChangeType.Gain,
            profile,
            days,
            page: 1,
            changes: result.changes,
        };

        await this.respondWithSession(ctx, "snipe_player_changes_view", data, this.snipePlayerChangesViewService);
    }
}
