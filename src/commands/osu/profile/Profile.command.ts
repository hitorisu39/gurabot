import { Command } from "@/core/decorators";
import { AbstractProfileCommand } from "./AbstractProfileCommand";
import { GameMode } from "@generated/adapter/types";

@Command({
    name: "profile",
    description: "Shows user information of an osu! player.",
    aliases: ["osu"],
})
export class ProfileCommand extends AbstractProfileCommand {}

@Command({
    name: "taiko",
    description: "Shows user information of an osu!taiko player.",
    prefixOnly: true,
})
export class TaikoProfileCommand extends AbstractProfileCommand {
    protected forcedMode = GameMode.Taiko;
}

@Command({
    name: "ctb",
    description: "Shows user information of an osu!catch player.",
    aliases: ["catch"],
    prefixOnly: true,
})
export class CtbProfileCommand extends AbstractProfileCommand {
    protected forcedMode = GameMode.Catch;
}

@Command({
    name: "mania",
    description: "Shows user information of an osu!mania player.",
    prefixOnly: true,
})
export class ManiaProfileCommand extends AbstractProfileCommand {
    protected forcedMode = GameMode.Mania;
}
