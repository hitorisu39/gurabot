import { Category, Command, Subcommand } from "@/core/decorators";
import { AbstractGraphTopCurveCommand } from "./AbstractGraphTopCurveCommand";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";

@Subcommand({
    root: "graph",
    group: "top",
    name: "curve",
    description: "Shows PP across a player's top-play positions.",
})
export class GraphTopCurveSubcommand extends AbstractGraphTopCurveCommand {}

@Command({
    name: "graphtopcurve",
    description: "Shows PP across a player's top-play positions.",
    aliases: ["gtc"],
    prefixOnly: true,
})
export class GraphTopCurveCommand extends AbstractGraphTopCurveCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikographtopcurve",
    description: "Shows PP across a player's osu!taiko top-play positions.",
    aliases: ["tgtc"],
    prefixOnly: true,
})
export class TaikoGraphTopCurveCommand extends AbstractGraphTopCurveCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchgraphtopcurve",
    description: "Shows PP across a player's osu!catch top-play positions.",
    aliases: ["cgtc"],
    prefixOnly: true,
})
export class CatchGraphTopCurveCommand extends AbstractGraphTopCurveCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniagraphtopcurve",
    description: "Shows PP across a player's osu!mania top-play positions.",
    aliases: ["mgtc"],
    prefixOnly: true,
})
export class ManiaGraphTopCurveCommand extends AbstractGraphTopCurveCommand {
    protected forcedMode = GameMode.Mania;
}
