import { Category, Command, Subcommand } from "@/core/decorators";
import { AbstractGraphOsuTrackGradesCommand } from "./AbstractGraphOsuTrackGradesCommand";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";

@Subcommand({
    root: "graph",
    group: "osutrack",
    name: "grades",
    description: "Shows a player's historical SS, S and A rank counts from osu!track.",
})
export class GraphOsuTrackGradesSubcommand extends AbstractGraphOsuTrackGradesCommand {}

@Command({
    name: "graphosutrackgrades",
    description: "Shows a player's historical SS, S and A rank counts from osu!track.",
    aliases: ["gogrades"],
    prefixOnly: true,
})
export class GraphOsuTrackGradesCommand extends AbstractGraphOsuTrackGradesCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikographosutrackgrades",
    description: "Shows a player's historical osu!taiko grade counts from osu!track.",
    aliases: ["tgogrades"],
    prefixOnly: true,
})
export class TaikoGraphOsuTrackGradesCommand extends AbstractGraphOsuTrackGradesCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchgraphosutrackgrades",
    description: "Shows a player's historical osu!catch grade counts from osu!track.",
    aliases: ["cgogrades"],
    prefixOnly: true,
})
export class CatchGraphOsuTrackGradesCommand extends AbstractGraphOsuTrackGradesCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniagraphosutrackgrades",
    description: "Shows a player's historical osu!mania grade counts from osu!track.",
    aliases: ["mgogrades"],
    prefixOnly: true,
})
export class ManiaGraphOsuTrackGradesCommand extends AbstractGraphOsuTrackGradesCommand {
    protected forcedMode = GameMode.Mania;
}
