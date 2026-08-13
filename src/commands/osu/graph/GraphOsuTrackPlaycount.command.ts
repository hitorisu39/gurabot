import { Category, Command, Subcommand } from "@/core/decorators";
import { AbstractGraphOsuTrackPlaycountCommand } from "./AbstractGraphOsuTrackPlaycountCommand";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";

@Subcommand({
    root: "graph",
    group: "osutrack",
    name: "playcount",
    description: "Shows a player's historical playcount progression from osu!track.",
})
export class GraphOsuTrackPlaycountSubcommand extends AbstractGraphOsuTrackPlaycountCommand {}

@Command({
    name: "graphosutrackplaycount",
    description: "Shows a player's historical playcount progression from osu!track.",
    aliases: ["gopc"],
    prefixOnly: true,
})
export class GraphOsuTrackPlaycountCommand extends AbstractGraphOsuTrackPlaycountCommand {}

// Taiko
@Category(ECommandCategory.Taiko)
@Command({
    name: "taikographosutrackplaycount",
    description: "Shows a player's historical osu!taiko playcount progression from osu!track.",
    aliases: ["tgopc"],
    prefixOnly: true,
})
export class TaikoGraphOsuTrackPlaycountCommand extends AbstractGraphOsuTrackPlaycountCommand {
    protected forcedMode = GameMode.Taiko;
}

// Catch
@Category(ECommandCategory.Catch)
@Command({
    name: "catchgraphosutrackplaycount",
    description: "Shows a player's historical osu!catch playcount progression from osu!track.",
    aliases: ["cgopc"],
    prefixOnly: true,
})
export class CatchGraphOsuTrackPlaycountCommand extends AbstractGraphOsuTrackPlaycountCommand {
    protected forcedMode = GameMode.Catch;
}

// Mania
@Category(ECommandCategory.Mania)
@Command({
    name: "maniagraphosutrackplaycount",
    description: "Shows a player's historical osu!mania playcount progression from osu!track.",
    aliases: ["mgopc"],
    prefixOnly: true,
})
export class ManiaGraphOsuTrackPlaycountCommand extends AbstractGraphOsuTrackPlaycountCommand {
    protected forcedMode = GameMode.Mania;
}
