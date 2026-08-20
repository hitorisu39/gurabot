import { Command } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";

@Command({
    name: "osustats",
    description: "Statistics about scores on osu! global leaderboards.",
    defer: false,
    slashOnly: true,
})
export class OsuStatsRootCommand extends AbstractCommand {
    public async execute(): Promise<void> {
        return;
    }
}
