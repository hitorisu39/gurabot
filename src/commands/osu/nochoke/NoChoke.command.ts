import { Category, Command } from "@/core/decorators";
import { GameMode } from "@generated/adapter/types";
import { AbstractNoChokeCommand } from "./AbstractNoChokeCommand";
import { ECommandCategory } from "@domain/core/Command";

@Command({
    name: "nochoke",
    description: "Shows projected top plays with misses removed.",
    aliases: ["nc", "nochokes"],
})
export class NoChokeCommand extends AbstractNoChokeCommand {}

// Taiko

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikonochoke",
    description: "Shows projected osu!taiko top plays with misses removed.",
    aliases: ["nct", "tnc", "nochoketaiko"],
    prefixOnly: true,
})
export class TaikoNoChokeCommand extends AbstractNoChokeCommand {
    protected forcedMode = GameMode.Taiko;
}

// Catch

@Category(ECommandCategory.Catch)
@Command({
    name: "catchnochoke",
    description: "Shows projected osu!catch top plays with misses removed.",
    aliases: ["ncc", "cnc", "nochokecatch"],
    prefixOnly: true,
})
export class CatchNoChokeCommand extends AbstractNoChokeCommand {
    protected forcedMode = GameMode.Catch;
}

// Mania

@Category(ECommandCategory.Mania)
@Command({
    name: "manianochoke",
    description: "Shows projected osu!mania top plays with misses removed.",
    aliases: ["ncm", "mnc", "nochokemania"],
    prefixOnly: true,
})
export class NoChokeManiaCommand extends AbstractNoChokeCommand {
    protected forcedMode = GameMode.Mania;
}
