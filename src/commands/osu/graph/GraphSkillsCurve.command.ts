import { Category, Command, Examples, Subcommand } from "@/core/decorators";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";
import { AbstractGraphSkillsCurveCommand } from "./AbstractGraphSkillsCurveCommand";

@Subcommand({
    root: "graph",
    group: "skills",
    name: "curve",
    description: "Shows skill strength across a player's top plays.",
})
export class GraphSkillsCurveSubcommand extends AbstractGraphSkillsCurveCommand {}

@Command({
    name: "graphskillscurve",
    description: "Shows skill strength across a player's top plays.",
    aliases: ["gsc"],
    prefixOnly: true,
})
@Examples("gsc", "gsc mrekk")
export class GraphSkillsCurveCommand extends AbstractGraphSkillsCurveCommand {}

// Taiko
@Category(ECommandCategory.Taiko)
@Command({
    name: "taikographskillscurve",
    description: "Shows skill strength across a player's osu!taiko top plays.",
    aliases: ["tgsc"],
    prefixOnly: true,
})
export class TaikoGraphSkillsCurveCommand extends AbstractGraphSkillsCurveCommand {
    protected forcedMode = GameMode.Taiko;
}

// Catch
@Category(ECommandCategory.Catch)
@Command({
    name: "catchgraphskillscurve",
    description: "Shows skill strength across a player's osu!catch top plays.",
    aliases: ["cgsc"],
    prefixOnly: true,
})
export class CatchGraphSkillsCurveCommand extends AbstractGraphSkillsCurveCommand {
    protected forcedMode = GameMode.Catch;
}

// Mania
@Category(ECommandCategory.Mania)
@Command({
    name: "maniagraphskillscurve",
    description: "Shows skill strength across a player's osu!mania top plays.",
    aliases: ["mgsc"],
    prefixOnly: true,
})
export class ManiaGraphSkillsCurveCommand extends AbstractGraphSkillsCurveCommand {
    protected forcedMode = GameMode.Mania;
}
