import { Category, Command, Examples, Subcommand } from "@/core/decorators";
import { AbstractGraphTopHoursCommand } from "./AbstractGraphTopHoursCommand";
import { GameMode } from "@generated/adapter/types";
import { ECommandCategory } from "@domain/core/Command";

@Subcommand({
    root: "graph",
    group: "top",
    name: "hours",
    description: "Shows what hours of the day a player's top plays were set.",
})
export class GraphTopHoursSubcommand extends AbstractGraphTopHoursCommand {}

@Command({
    name: "graphtophours",
    description: "Shows what hours of the day a player's top plays were set.",
    aliases: ["gth"],
    prefixOnly: true,
})
export class GraphTopHoursCommand extends AbstractGraphTopHoursCommand {}

// Taiko
@Category(ECommandCategory.Taiko)
@Command({
    name: "taikographtophours",
    description: "Shows what hours of the day a player's osu!taiko top plays were set.",
    aliases: ["tgth"],
    prefixOnly: true,
})
@Examples("tgth", "tgth +3", "tgth -05:00 username")
export class TaikoGraphTopHoursCommand extends AbstractGraphTopHoursCommand {
    protected forcedMode = GameMode.Taiko;
}

// Catch
@Category(ECommandCategory.Catch)
@Command({
    name: "catchgraphtophours",
    description: "Shows what hours of the day a player's osu!catch top plays were set.",
    aliases: ["cgth"],
    prefixOnly: true,
})
@Examples("cgth", "cgth +3", "cgth -05:00 username")
export class CatchGraphTopHoursCommand extends AbstractGraphTopHoursCommand {
    protected forcedMode = GameMode.Catch;
}

// Mania
@Category(ECommandCategory.Mania)
@Command({
    name: "maniagraphtophours",
    description: "Shows what hours of the day a player's osu!mania top plays were set.",
    aliases: ["mgth"],
    prefixOnly: true,
})
@Examples("mgth", "mgth +3", "mgth -05:00 username")
export class ManiaGraphTopHoursCommand extends AbstractGraphTopHoursCommand {
    protected forcedMode = GameMode.Mania;
}
