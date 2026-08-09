import { Category, Command } from "@/core/decorators";
import { GameMode } from "@generated/adapter/types";
import { AbstractWhatIfCommand } from "./AbstractWhatIfCommand";
import { ECommandCategory } from "@domain/core/Command";

@Command({
    name: "whatif",
    description: "Calculates the pp change from a hypothetical new performance play.",
    aliases: ["wi", "wif"],
})
export class WhatIfCommand extends AbstractWhatIfCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikowhatif",
    description: "Calculates the osu!taiko pp change from a hypothetical new performance play.",
    aliases: ["whatiftaiko", "taikowi", "witaiko", "twi"],
    prefixOnly: true,
})
export class TaikoWhatIfCommand extends AbstractWhatIfCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchwhatif",
    description: "Calculates the osu!catch pp change from a hypothetical new performance play.",
    aliases: ["whatifctb", "ctbwhatif", "whatifcatch", "ctbwi", "catchwi", "cwi"],
    prefixOnly: true,
})
export class CatchWhatIfCommand extends AbstractWhatIfCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniawhatif",
    description: "Calculates the osu!mania pp change from a hypothetical new performance play.",
    aliases: ["whatifmania", "maniawi", "wimania", "mwi"],
    prefixOnly: true,
})
export class ManiaWhatIfCommand extends AbstractWhatIfCommand {
    protected forcedMode = GameMode.Mania;
}
