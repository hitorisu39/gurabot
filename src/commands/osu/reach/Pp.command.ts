import { Category, Command } from "@/core/decorators";
import { GameMode } from "@generated/adapter/types";
import { ECommandCategory } from "@domain/core/Command";
import { AbstractPpCommand } from "./AbstractPpCommand";

@Command({
    name: "pp",
    description: "Calculates the plays required to reach a target amount of pp.",
})
export class PpCommand extends AbstractPpCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikopp",
    description: "Calculates the plays required to reach a target osu!taiko pp.",
    aliases: ["pptaiko", "tpp"],
    prefixOnly: true,
})
export class TaikoPPCommand extends AbstractPpCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchpp",
    description: "Calculates the plays required to reach a target osu!catch pp.",
    aliases: ["ctbpp", "ppcatch", "cpp"],
    prefixOnly: true,
})
export class CatchPPCommand extends AbstractPpCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniapp",
    description: "Calculates the plays required to reach a target osu!mania pp.",
    aliases: ["ppmania", "mpp"],
    prefixOnly: true,
})
export class ManiaPPCommand extends AbstractPpCommand {
    protected forcedMode = GameMode.Mania;
}
