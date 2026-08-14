import { Category, Command } from "@/core/decorators";
import { GameMode } from "@generated/adapter/types";
import { AbstractPinnedCommand } from "./AbstractPinnedCommand";
import { ECommandCategory } from "@domain/core/Command";

@Command({
    name: "pinned",
    description: "Shows pinned plays of an osu! player.",
    aliases: ["pin", "p"],
})
export class PinnedCommand extends AbstractPinnedCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikopinned",
    description: "Shows pinned taiko plays of an osu! player.",
    aliases: ["pinnedtaiko", "taikopin", "pintaiko", "tpin"],
    prefixOnly: true,
})
export class TaikoPinnedCommand extends AbstractPinnedCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchpinned",
    description: "Shows pinned catch plays of an osu! player.",
    aliases: ["pinnedcatch", "catchpin", "pincatch", "cpin"],
    prefixOnly: true,
})
export class CatchPinnedCommand extends AbstractPinnedCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniapinned",
    description: "Shows pinned mania plays of an osu! player.",
    aliases: ["pinnedmania", "maniapin", "pinmania", "mpin"],
    prefixOnly: true,
})
export class ManiaPinnedCommand extends AbstractPinnedCommand {
    protected forcedMode = GameMode.Mania;
}
