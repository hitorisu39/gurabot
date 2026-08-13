import { Category, Command, Subcommand } from "@/core/decorators";
import { AbstractGraphOsuTrackPpCommand } from "./AbstractGraphOsuTrackPpCommand";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";

@Subcommand({
    root: "graph",
    group: "osutrack",
    name: "pp",
    description: "Shows a player's historical PP progression from osu!track.",
})
export class GraphOsuTrackPpSubcommand extends AbstractGraphOsuTrackPpCommand {}

@Command({
    name: "graphosutrackpp",
    description: "Shows a player's historical PP progression from osu!track.",
    aliases: ["gopp"],
    prefixOnly: true,
})
export class GraphOsuTrackPpCommand extends AbstractGraphOsuTrackPpCommand {}

// Taiko
@Category(ECommandCategory.Taiko)
@Command({
    name: "taikographosutrackpp",
    description: "Shows a player's historical osu!taiko PP progression from osu!track.",
    aliases: ["tgopp"],
    prefixOnly: true,
})
export class TaikoGraphOsuTrackPpCommand extends AbstractGraphOsuTrackPpCommand {
    protected forcedMode = GameMode.Taiko;
}

// Catch
@Category(ECommandCategory.Catch)
@Command({
    name: "catchgraphosutrackpp",
    description: "Shows a player's historical osu!catch PP progression from osu!track.",
    aliases: ["cgopp"],
    prefixOnly: true,
})
export class CatchGraphOsuTrackPpCommand extends AbstractGraphOsuTrackPpCommand {
    protected forcedMode = GameMode.Catch;
}

// Mania
@Category(ECommandCategory.Mania)
@Command({
    name: "maniagraphosutrackpp",
    description: "Shows a player's historical osu!mania PP progression from osu!track.",
    aliases: ["mgopp"],
    prefixOnly: true,
})
export class ManiaGraphOsuTrackPpCommand extends AbstractGraphOsuTrackPpCommand {
    protected forcedMode = GameMode.Mania;
}
