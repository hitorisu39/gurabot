import { Category, Command, Subcommand } from "@/core/decorators";
import { AbstractGraphOsuTrackAccuracyCommand } from "./AbstractGraphOsuTrackAccuracyCommand";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";

@Subcommand({
    root: "graph",
    group: "osutrack",
    name: "accuracy",
    description: "Shows a player's historical accuracy progression from osu!track.",
})
export class GraphOsuTrackAccuracySubcommand extends AbstractGraphOsuTrackAccuracyCommand {}

@Command({
    name: "graphosutrackaccuracy",
    description: "Shows a player's historical accuracy progression from osu!track.",
    aliases: ["goacc"],
    prefixOnly: true,
})
export class GraphOsuTrackAccuracyCommand extends AbstractGraphOsuTrackAccuracyCommand {}

// Taiko
@Category(ECommandCategory.Taiko)
@Command({
    name: "taikographosutrackaccuracy",
    description: "Shows a player's historical osu!taiko accuracy progression from osu!track.",
    aliases: ["tgoacc"],
    prefixOnly: true,
})
export class TaikoGraphOsuTrackAccuracyCommand extends AbstractGraphOsuTrackAccuracyCommand {
    protected forcedMode = GameMode.Taiko;
}

// Catch
@Category(ECommandCategory.Catch)
@Command({
    name: "catchgraphosutrackaccuracy",
    description: "Shows a player's historical osu!catch accuracy progression from osu!track.",
    aliases: ["cgoacc"],
    prefixOnly: true,
})
export class CatchGraphOsuTrackAccuracyCommand extends AbstractGraphOsuTrackAccuracyCommand {
    protected forcedMode = GameMode.Catch;
}

// Mania
@Category(ECommandCategory.Mania)
@Command({
    name: "maniagraphosutrackaccuracy",
    description: "Shows a player's historical osu!mania accuracy progression from osu!track.",
    aliases: ["mgoacc"],
    prefixOnly: true,
})
export class ManiaGraphOsuTrackAccuracyCommand extends AbstractGraphOsuTrackAccuracyCommand {
    protected forcedMode = GameMode.Mania;
}
