import { Category, Command, Subcommand } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { AbstractGraphHistoryCommand } from "./AbstractGraphHistoryCommand";
import { ECommandCategory } from "@domain/core/Command";

@Category(ECommandCategory.Osu)
@Command({
    name: "graph",
    description: "The root command for graph subcommands",
    defer: false,
    slashOnly: true,
})
export class GraphRootCommand extends AbstractCommand {
    public async execute(): Promise<void> {
        return;
    }
}

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
