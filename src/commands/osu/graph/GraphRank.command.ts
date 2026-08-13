import { Category, Command, Subcommand } from "@/core/decorators";
import { AbstractGraphRankCommand } from "./AbstractGraphRankCommand";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";

@Subcommand({
    root: "graph",
    name: "rank",
    description: "Shows a player's rank history.",
})
export class GraphRankSubcommand extends AbstractGraphRankCommand {}

@Command({
    name: "graphrank",
    description: "Shows a player's rank history.",
    aliases: ["gr", "rg"],
    prefixOnly: true,
})
export class GraphRankCommand extends AbstractGraphRankCommand {}

// Taiko

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikographrank",
    description: "Shows a player's osu!taiko rank history.",
    aliases: ["tgr", "grt"],
    prefixOnly: true,
})
export class TaikoGraphRankCommand extends AbstractGraphRankCommand {
    protected forcedMode = GameMode.Taiko;
}

// Catch

@Category(ECommandCategory.Catch)
@Command({
    name: "catchgraphrank",
    description: "Shows a player's osu!catch rank history.",
    aliases: ["cgr", "grc"],
    prefixOnly: true,
})
export class CatchGraphRankCommand extends AbstractGraphRankCommand {
    protected forcedMode = GameMode.Catch;
}

// Mania

@Category(ECommandCategory.Mania)
@Command({
    name: "maniagraphrank",
    description: "Shows a player's osu!mania rank history.",
    aliases: ["mgr", "grm"],
    prefixOnly: true,
})
export class ManiaGraphRankCommand extends AbstractGraphRankCommand {
    protected forcedMode = GameMode.Mania;
}
