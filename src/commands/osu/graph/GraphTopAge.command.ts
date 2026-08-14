import { Category, Command, Subcommand } from "@/core/decorators";
import { AbstractGraphTopAgeCommand } from "./AbstractGraphTopAgeCommand";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";

@Subcommand({
    root: "graph",
    group: "top",
    name: "age",
    description: "Shows when a player's current top plays were set.",
})
export class GraphTopAgeSubcommand extends AbstractGraphTopAgeCommand {}

@Command({
    name: "graphtopage",
    description: "Shows when a player's current top plays were set.",
    aliases: ["gta"],
    prefixOnly: true,
})
export class GraphTopAgeCommand extends AbstractGraphTopAgeCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikographtopage",
    description: "Shows when a player's current osu!taiko top plays were set.",
    aliases: ["tgta"],
    prefixOnly: true,
})
export class TaikoGraphTopAgeCommand extends AbstractGraphTopAgeCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchgraphtopage",
    description: "Shows when a player's current osu!catch top plays were set.",
    aliases: ["cgta"],
    prefixOnly: true,
})
export class CatchGraphTopAgeCommand extends AbstractGraphTopAgeCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniagraphtopage",
    description: "Shows when a player's current osu!mania top plays were set.",
    aliases: ["mgta"],
    prefixOnly: true,
})
export class ManiaGraphTopAgeCommand extends AbstractGraphTopAgeCommand {
    protected forcedMode = GameMode.Mania;
}
