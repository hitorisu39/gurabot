import { Category, Command, Subcommand } from "@/core/decorators";
import { AbstractGraphOsuTrackRankCommand } from "./AbstractGraphOsuTrackRankCommand";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";

@Subcommand({
    root: "graph",
    group: "osutrack",
    name: "rank",
    description: "Shows a player's historical global rank progression from osu!track.",
})
export class GraphOsuTrackRankSubcommand extends AbstractGraphOsuTrackRankCommand {}

@Command({
    name: "graphosutrackrank",
    description: "Shows a player's historical global rank progression from osu!track.",
    aliases: ["gorank"],
    prefixOnly: true,
})
export class GraphOsuTrackRankCommand extends AbstractGraphOsuTrackRankCommand {}

// Taiko
@Category(ECommandCategory.Taiko)
@Command({
    name: "taikographosutrackrank",
    description: "Shows a player's historical osu!taiko global rank progression from osu!track.",
    aliases: ["tgorank"],
    prefixOnly: true,
})
export class TaikoGraphOsuTrackRankCommand extends AbstractGraphOsuTrackRankCommand {
    protected forcedMode = GameMode.Taiko;
}

// Catch
@Category(ECommandCategory.Catch)
@Command({
    name: "catchgraphosutrackrank",
    description: "Shows a player's historical osu!catch global rank progression from osu!track.",
    aliases: ["cgorank"],
    prefixOnly: true,
})
export class CatchGraphOsuTrackRankCommand extends AbstractGraphOsuTrackRankCommand {
    protected forcedMode = GameMode.Catch;
}

// Mania
@Category(ECommandCategory.Mania)
@Command({
    name: "maniagraphosutrackrank",
    description: "Shows a player's historical osu!mania global rank progression from osu!track.",
    aliases: ["mgorank"],
    prefixOnly: true,
})
export class ManiaGraphOsuTrackRankCommand extends AbstractGraphOsuTrackRankCommand {
    protected forcedMode = GameMode.Mania;
}
