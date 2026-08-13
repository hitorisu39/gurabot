import { Category, Command, Subcommand } from "@/core/decorators";
import { AbstractGraphOsuTrackScoresCommand } from "./AbstractGraphOsuTrackScoresCommand";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";

@Subcommand({
    root: "graph",
    group: "osutrack",
    name: "scores",
    description: "Shows a player's historical ranked and total score progression from osu!track.",
})
export class GraphOsuTrackScoresSubcommand extends AbstractGraphOsuTrackScoresCommand {}

@Command({
    name: "graphosutrackscores",
    description: "Shows a player's historical ranked and total score progression from osu!track.",
    aliases: ["goscores"],
    prefixOnly: true,
})
export class GraphOsuTrackScoresCommand extends AbstractGraphOsuTrackScoresCommand {}

// Taiko
@Category(ECommandCategory.Taiko)
@Command({
    name: "taikographosutrackscores",
    description: "Shows a player's historical osu!taiko score progression from osu!track.",
    aliases: ["tgoscores"],
    prefixOnly: true,
})
export class TaikoGraphOsuTrackScoresCommand extends AbstractGraphOsuTrackScoresCommand {
    protected forcedMode = GameMode.Taiko;
}

// Catch
@Category(ECommandCategory.Catch)
@Command({
    name: "catchgraphosutrackscores",
    description: "Shows a player's historical osu!catch score progression from osu!track.",
    aliases: ["cgoscores"],
    prefixOnly: true,
})
export class CatchGraphOsuTrackScoresCommand extends AbstractGraphOsuTrackScoresCommand {
    protected forcedMode = GameMode.Catch;
}

// Mania
@Category(ECommandCategory.Mania)
@Command({
    name: "maniagraphosutrackscores",
    description: "Shows a player's historical osu!mania score progression from osu!track.",
    aliases: ["mgoscores"],
    prefixOnly: true,
})
export class ManiaGraphOsuTrackScoresCommand extends AbstractGraphOsuTrackScoresCommand {
    protected forcedMode = GameMode.Mania;
}
