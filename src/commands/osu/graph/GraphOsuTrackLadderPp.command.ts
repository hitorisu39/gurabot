import { Category, Command, Subcommand } from "@/core/decorators";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";
import { AbstractGraphOsuTrackLadderCommand } from "./AbstractGraphOsuTrackLadderCommand";
import { EOsuTrackLadderMetric } from "@domain/osutrack/enums/OsuTrackLadder.enum";

abstract class AbstractGraphOsuTrackLadderPpCommand extends AbstractGraphOsuTrackLadderCommand {
    protected readonly metric = EOsuTrackLadderMetric.Pp;
}

@Subcommand({
    root: "graph",
    group: "ladder",
    name: "pp",
    description: "Shows the PP distribution across the global osu! ladder.",
})
export class GraphOsuTrackLadderPpSubcommand extends AbstractGraphOsuTrackLadderPpCommand {}

@Command({
    name: "graphladderpp",
    description: "Shows the PP distribution across the global osu! ladder.",
    aliases: ["glpp"],
    prefixOnly: true,
})
export class GraphOsuTrackLadderPpCommand extends AbstractGraphOsuTrackLadderPpCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikographladderpp",
    description: "Shows the PP distribution across the global osu!taiko ladder.",
    aliases: ["tglpp"],
    prefixOnly: true,
})
export class TaikoGraphOsuTrackLadderPpCommand extends AbstractGraphOsuTrackLadderPpCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchgraphladderpp",
    description: "Shows the PP distribution across the global osu!catch ladder.",
    aliases: ["cglpp"],
    prefixOnly: true,
})
export class CatchGraphOsuTrackLadderPpCommand extends AbstractGraphOsuTrackLadderPpCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniagraphladderpp",
    description: "Shows the PP distribution across the global osu!mania ladder.",
    aliases: ["mglpp"],
    prefixOnly: true,
})
export class ManiaGraphOsuTrackLadderPpCommand extends AbstractGraphOsuTrackLadderPpCommand {
    protected forcedMode = GameMode.Mania;
}
