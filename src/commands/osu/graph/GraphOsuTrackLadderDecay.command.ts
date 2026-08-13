import { Category, Command, Subcommand } from "@/core/decorators";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";
import { AbstractGraphOsuTrackLadderCommand } from "./AbstractGraphOsuTrackLadderCommand";
import { EOsuTrackLadderMetric } from "@domain/osutrack/enums/OsuTrackLadder.enum";

abstract class AbstractGraphOsuTrackLadderDecayCommand extends AbstractGraphOsuTrackLadderCommand {
    protected readonly metric = EOsuTrackLadderMetric.Decay;
}

@Subcommand({
    root: "graph",
    group: "ladder",
    name: "decay",
    description: "Shows expected natural rank decay across the global ladder.",
})
export class GraphOsuTrackLadderDecaySubcommand extends AbstractGraphOsuTrackLadderDecayCommand {}

@Command({
    name: "graphladderdecay",
    description: "Shows expected natural rank decay across the global ladder.",
    aliases: ["gldec"],
    prefixOnly: true,
})
export class GraphOsuTrackLadderDecayCommand extends AbstractGraphOsuTrackLadderDecayCommand {}

// Taiko
@Category(ECommandCategory.Taiko)
@Command({
    name: "taikographladderdecay",
    description: "Shows expected natural rank decay across the global osu!taiko ladder.",
    aliases: ["tgldec"],
    prefixOnly: true,
})
export class TaikoGraphOsuTrackLadderDecayCommand extends AbstractGraphOsuTrackLadderDecayCommand {
    protected forcedMode = GameMode.Taiko;
}

// Catch
@Category(ECommandCategory.Catch)
@Command({
    name: "catchgraphladderdecay",
    description: "Shows expected natural rank decay across the global osu!catch ladder.",
    aliases: ["cgldec"],
    prefixOnly: true,
})
export class CatchGraphOsuTrackLadderDecayCommand extends AbstractGraphOsuTrackLadderDecayCommand {
    protected forcedMode = GameMode.Catch;
}

// Mania
@Category(ECommandCategory.Mania)
@Command({
    name: "maniagraphladderdecay",
    description: "Shows expected natural rank decay across the global osu!mania ladder.",
    aliases: ["mgldec"],
    prefixOnly: true,
})
export class ManiaGraphOsuTrackLadderDecayCommand extends AbstractGraphOsuTrackLadderDecayCommand {
    protected forcedMode = GameMode.Mania;
}
