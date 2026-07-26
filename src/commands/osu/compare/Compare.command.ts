import { Command } from "@/core/decorators";
import { GameMode } from "@generated/adapter/types";
import { AbstractCompareCommand } from "./AbstractCompareCommand";

@Command({
    name: "compare",
    description: "Compares your scores on a specific beatmap.",
    aliases: ["c", "gap", "comp"],
})
export class CompareCommand extends AbstractCompareCommand {}

@Command({
    name: "taikocompare",
    description: "Compares your taiko scores on a specific beatmap.",
    aliases: ["comparetaiko", "ct", "tcompare", "tc"],
    prefixOnly: true,
})
export class TaikoCompareCommand extends AbstractCompareCommand {
    protected forcedMode = GameMode.Taiko;
}

@Command({
    name: "ctbcompare",
    description: "Compares your catch scores on a specific beatmap.",
    aliases: ["comparectb", "catchcompare", "comparecatch", "ccompare", "cc"],
    prefixOnly: true,
})
export class CtbCompareCommand extends AbstractCompareCommand {
    protected forcedMode = GameMode.Catch;
}

@Command({
    name: "maniacompare",
    description: "Compares your mania scores on a specific beatmap.",
    aliases: ["comparemania", "comparem", "mcompare", "cm"],
    prefixOnly: true,
})
export class ManiaCompareCommand extends AbstractCompareCommand {
    protected forcedMode = GameMode.Mania;
}
