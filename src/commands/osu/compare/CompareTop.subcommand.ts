import { Category, Command, Subcommand } from "@/core/decorators";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";
import { AbstractCompareTopCommand } from "./AbstractCompareTopCommand";

@Subcommand({
    root: "compare",
    name: "top",
    description: "Compares maps shared between two players' top plays.",
})
export class CompareTopSubcommand extends AbstractCompareTopCommand {}

@Command({
    name: "common",
    description: "Compares maps shared between two players' top plays.",
    aliases: ["commontop", "topcommon"],
    prefixOnly: true,
})
export class CommonCommand extends AbstractCompareTopCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikocommon",
    description: "Compares shared osu!taiko top plays between two players.",
    aliases: ["commontaiko", "tcommon"],
    prefixOnly: true,
})
export class TaikoCommonCommand extends AbstractCompareTopCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchcommon",
    description: "Compares shared osu!catch top plays between two players.",
    aliases: ["commoncatch", "ctbcommon", "ccommon"],
    prefixOnly: true,
})
export class CatchCommonCommand extends AbstractCompareTopCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniacommon",
    description: "Compares shared osu!mania top plays between two players.",
    aliases: ["commonmania", "mcommon"],
    prefixOnly: true,
})
export class ManiaCommonCommand extends AbstractCompareTopCommand {
    protected forcedMode = GameMode.Mania;
}
