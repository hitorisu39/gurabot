import { Category, Command } from "@/core/decorators";
import { AbstractProfileCommand } from "./AbstractProfileCommand";
import { GameMode } from "@generated/adapter/types";
import { ECommandCategory } from "@domain/core/Command";

@Command({
    name: "profile",
    description: "Shows user information of an osu! player.",
    aliases: ["osu"],
})
export class ProfileCommand extends AbstractProfileCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taiko",
    description: "Shows user information of an osu!taiko player.",
    prefixOnly: true,
})
export class TaikoProfileCommand extends AbstractProfileCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catch",
    description: "Shows user information of an osu!catch player.",
    aliases: ["ctb"],
    prefixOnly: true,
})
export class CatchProfileCommand extends AbstractProfileCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "mania",
    description: "Shows user information of an osu!mania player.",
    prefixOnly: true,
})
export class ManiaProfileCommand extends AbstractProfileCommand {
    protected forcedMode = GameMode.Mania;
}
