import { Category, Command, Subcommand } from "@/core/decorators";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";
import { AbstractGraphTopRankedDateCommand } from "./AbstractGraphTopRankedDateCommand";

@Subcommand({
    root: "graph",
    group: "top",
    name: "rankeddate",
    description: "Shows when the maps in a player's top plays were ranked.",
})
export class GraphTopRankedDateSubcommand extends AbstractGraphTopRankedDateCommand {}

@Command({
    name: "graphtoprankeddate",
    description: "Shows when the maps in a player's top plays were ranked.",
    aliases: ["gtrd"],
    prefixOnly: true,
})
export class GraphTopRankedDateCommand extends AbstractGraphTopRankedDateCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikographtoprankeddate",
    description: "Shows when the maps in a player's osu!taiko top plays were ranked.",
    aliases: ["tgtrd"],
    prefixOnly: true,
})
export class TaikoGraphTopRankedDateCommand extends AbstractGraphTopRankedDateCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchgraphtoprankeddate",
    description: "Shows when the maps in a player's osu!catch top plays were ranked.",
    aliases: ["cgtrd"],
    prefixOnly: true,
})
export class CatchGraphTopRankedDateCommand extends AbstractGraphTopRankedDateCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniagraphtoprankeddate",
    description: "Shows when the maps in a player's osu!mania top plays were ranked.",
    aliases: ["mgtrd"],
    prefixOnly: true,
})
export class ManiaGraphTopRankedDateCommand extends AbstractGraphTopRankedDateCommand {
    protected forcedMode = GameMode.Mania;
}
