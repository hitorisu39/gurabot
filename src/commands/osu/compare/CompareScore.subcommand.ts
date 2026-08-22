import { ECommandCategory } from "@domain/core/Command";
import { AbstractCompareCommand } from "./AbstractCompareCommand";
import { Category, Command, Subcommand } from "@/core/decorators";
import { GameMode } from "@generated/adapter/types";

@Subcommand({
    root: "compare",
    name: "score",
    description: "Compares your scores on a specific beatmap.",
})
export class CompareScoreSubcommand extends AbstractCompareCommand {}

@Command({
    name: "cs",
    description: "Compares your scores on a specific beatmap.",
    slashOnly: true,
})
export class CompareScoreSlashAliasCommand extends AbstractCompareCommand {}

@Category(ECommandCategory.Osu)
@Command({
    name: "comparescore",
    description: "Compares your scores on a specific beatmap.",
    aliases: ["compare", "c", "gap", "comp"],
    prefixOnly: true,
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
