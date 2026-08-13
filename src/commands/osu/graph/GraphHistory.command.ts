import { Command, Subcommand } from "@/core/decorators";
import { AbstractGraphHistoryCommand } from "./AbstractGraphHistoryCommand";

@Subcommand({
    root: "graph",
    name: "history",
    description: "Shows a player's monthly playcount history.",
})
export class GraphHistorySubcommand extends AbstractGraphHistoryCommand {}

@Command({
    name: "graphhistory",
    description: "Shows a player's monthly playcount history.",
    aliases: ["gh", "hg"],
    prefixOnly: true,
})
export class GraphHistoryCommand extends AbstractGraphHistoryCommand {}
