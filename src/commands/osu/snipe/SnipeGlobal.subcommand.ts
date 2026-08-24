import { Subcommand } from "@/core/decorators";
import { AbstractSnipeRankingCommand } from "./AbstractSnipeRankingCommand";

@Subcommand({
    root: "snipe",
    name: "global",
    description: "Shows the global osu! national #1 leaderboard.",
})
export class SnipeGlobalSubcommand extends AbstractSnipeRankingCommand {
    protected resolveCountry(): string {
        return "global";
    }
}
