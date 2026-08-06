import { Command } from "@/core/decorators";
import { GameMode } from "@generated/adapter/types";
import { AbstractNoChokeCommand } from "./AbstractNoChokeCommand";

@Command({
    name: "nochoke",
    description: "Shows projected top plays with misses removed.",
    aliases: ["nc", "nochokes"],
})
export class NoChokeCommand extends AbstractNoChokeCommand {}

// Taiko

@Command({
    name: "nochoketaiko",
    description: "Shows projected osu!taiko top plays with misses removed.",
    aliases: ["nct", "tnc"],
    prefixOnly: true,
})
export class NoChokeTaikoCommand extends AbstractNoChokeCommand {
    protected forcedMode = GameMode.Taiko;
}

// Catch

@Command({
    name: "nochokecatch",
    description: "Shows projected osu!catch top plays with misses removed.",
    aliases: ["ncc", "cnc"],
    prefixOnly: true,
})
export class NoChokeCatchCommand extends AbstractNoChokeCommand {
    protected forcedMode = GameMode.Catch;
}

// Mania

@Command({
    name: "nochokemania",
    description: "Shows projected osu!mania top plays with misses removed.",
    aliases: ["ncm", "mnc"],
    prefixOnly: true,
})
export class NoChokeManiaCommand extends AbstractNoChokeCommand {
    protected forcedMode = GameMode.Mania;
}
