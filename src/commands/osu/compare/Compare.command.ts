import { Category, Command } from "@/core/decorators";
import { GameMode } from "@generated/adapter/types";
import { AbstractCompareCommand } from "./AbstractCompareCommand";
import { ECommandCategory } from "@domain/core/Command";

@Command({
    name: "compare",
    description: "Compares your scores on a specific beatmap.",
    aliases: ["c", "gap", "comp"],
})
export class CompareCommand extends AbstractCompareCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikocompare",
    description: "Compares your taiko scores on a specific beatmap.",
    aliases: ["comparetaiko", "ct", "tcompare"],
    prefixOnly: true,
})
export class TaikoCompareCommand extends AbstractCompareCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchcompare",
    description: "Compares your catch scores on a specific beatmap.",
    aliases: ["comparectb", "ctbcompare", "comparecatch", "ccompare", "cc"],
    prefixOnly: true,
})
export class CatchCompareCommand extends AbstractCompareCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniacompare",
    description: "Compares your mania scores on a specific beatmap.",
    aliases: ["comparemania", "comparem", "mcompare", "cm"],
    prefixOnly: true,
})
export class ManiaCompareCommand extends AbstractCompareCommand {
    protected forcedMode = GameMode.Mania;
}
