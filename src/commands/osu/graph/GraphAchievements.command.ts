import { Command, Subcommand } from "@/core/decorators";
import { AbstractGraphAchievementsCommand } from "./AbstractGraphAchievementsCommand";

@Subcommand({
    root: "graph",
    name: "achievements",
    description: "Shows a player's achievement history.",
})
export class GraphAchievementsSubcommand extends AbstractGraphAchievementsCommand {}

@Command({
    name: "graphachievements",
    description: "Shows a player's achievement history.",
    aliases: ["graphmedals", "ga", "ag"],
    prefixOnly: true,
})
export class GraphAchievementsCommand extends AbstractGraphAchievementsCommand {}
