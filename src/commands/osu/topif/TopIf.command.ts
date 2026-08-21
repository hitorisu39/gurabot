import { Category, Command } from "@/core/decorators";
import { GameMode } from "@generated/adapter/types";
import { AbstractTopIfCommand } from "./AbstractTopIfCommand";
import { ECommandCategory } from "@domain/core/Command";

@Command({
    name: "topif",
    description: "Shows hypothetical top plays after changing their mods.",
    aliases: ["ti"],
})
export class TopIfCommand extends AbstractTopIfCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikotopif",
    description: "Shows hypothetical osu!taiko top plays after changing their mods.",
    aliases: ["topiftaiko", "tit", "tti"],
    prefixOnly: true,
})
export class TaikoTopIfCommand extends AbstractTopIfCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchtopif",
    description: "Shows hypothetical osu!catch top plays after changing their mods.",
    aliases: ["topifcatch", "tic", "cti"],
    prefixOnly: true,
})
export class CatchTopIfCommand extends AbstractTopIfCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniatopif",
    description: "Shows hypothetical osu!mania top plays after changing their mods.",
    aliases: ["topifmania", "tim", "mti"],
    prefixOnly: true,
})
export class ManiaTopIfCommand extends AbstractTopIfCommand {
    protected forcedMode = GameMode.Mania;
}
