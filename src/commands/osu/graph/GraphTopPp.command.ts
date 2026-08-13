import { Category, Command, Subcommand } from "@/core/decorators";
import { AbstractGraphTopPpCommand } from "./AbstractGraphTopPpCommand";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";

@Subcommand({
    root: "graph",
    group: "top",
    name: "pp",
    description: "Shows the PP distribution of a player's top plays.",
})
export class GraphTopPpSubcommand extends AbstractGraphTopPpCommand {}

@Command({
    name: "graphtoppp",
    description: "Shows the PP distribution of a player's top plays.",
    aliases: ["gtp"],
    prefixOnly: true,
})
export class GraphTopPpCommand extends AbstractGraphTopPpCommand {}

// Taiko
@Category(ECommandCategory.Taiko)
@Command({
    name: "taikographtoppp",
    description: "Shows the PP distribution of a player's osu!taiko top plays.",
    aliases: ["tgtp"],
    prefixOnly: true,
})
export class TaikoGraphTopPpCommand extends AbstractGraphTopPpCommand {
    protected forcedMode = GameMode.Taiko;
}

// Catch
@Category(ECommandCategory.Catch)
@Command({
    name: "catchgraphtoppp",
    description: "Shows the PP distribution of a player's osu!catch top plays.",
    aliases: ["cgtp"],
    prefixOnly: true,
})
export class CatchGraphTopPpCommand extends AbstractGraphTopPpCommand {
    protected forcedMode = GameMode.Catch;
}

// Mania
@Category(ECommandCategory.Mania)
@Command({
    name: "maniagraphtoppp",
    description: "Shows the PP distribution of a player's osu!mania top plays.",
    aliases: ["mgtp"],
    prefixOnly: true,
})
export class ManiaGraphTopPpCommand extends AbstractGraphTopPpCommand {
    protected forcedMode = GameMode.Mania;
}
