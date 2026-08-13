import { Category, Command, Subcommand } from "@/core/decorators";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";
import { AbstractGraphOsuTrackLadderCommand } from "./AbstractGraphOsuTrackLadderCommand";
import { EOsuTrackLadderMetric } from "@domain/osutrack/enums/OsuTrackLadder.enum";

abstract class AbstractGraphOsuTrackLadderDensityCommand extends AbstractGraphOsuTrackLadderCommand {
    protected readonly metric = EOsuTrackLadderMetric.Density;
}

@Subcommand({
    root: "graph",
    group: "ladder",
    name: "density",
    description: "Shows how many global ranks are gained per PP across the ladder.",
})
export class GraphOsuTrackLadderDensitySubcommand extends AbstractGraphOsuTrackLadderDensityCommand {}

@Command({
    name: "graphladderdensity",
    description: "Shows how many global ranks are gained per PP across the ladder.",
    aliases: ["glden"],
    prefixOnly: true,
})
export class GraphOsuTrackLadderDensityCommand extends AbstractGraphOsuTrackLadderDensityCommand {}

// Taiko
@Category(ECommandCategory.Taiko)
@Command({
    name: "taikographladderdensity",
    description: "Shows PP density across the global osu!taiko ladder.",
    aliases: ["tglden"],
    prefixOnly: true,
})
export class TaikoGraphOsuTrackLadderDensityCommand extends AbstractGraphOsuTrackLadderDensityCommand {
    protected forcedMode = GameMode.Taiko;
}

// Catch
@Category(ECommandCategory.Catch)
@Command({
    name: "catchgraphladderdensity",
    description: "Shows PP density across the global osu!catch ladder.",
    aliases: ["cglden"],
    prefixOnly: true,
})
export class CatchGraphOsuTrackLadderDensityCommand extends AbstractGraphOsuTrackLadderDensityCommand {
    protected forcedMode = GameMode.Catch;
}

// Mania
@Category(ECommandCategory.Mania)
@Command({
    name: "maniagraphladderdensity",
    description: "Shows PP density across the global osu!mania ladder.",
    aliases: ["mglden"],
    prefixOnly: true,
})
export class ManiaGraphOsuTrackLadderDensityCommand extends AbstractGraphOsuTrackLadderDensityCommand {
    protected forcedMode = GameMode.Mania;
}
