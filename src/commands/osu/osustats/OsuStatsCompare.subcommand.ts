import { Category, Command, Subcommand } from "@/core/decorators";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";
import { AbstractOsuStatsCompareCommand } from "./AbstractOsuStatsCompareCommand";

@Subcommand({
    root: "osustats",
    name: "compare",
    description: "Compares two players' global leaderboard appearances.",
})
export class OsuStatsCompareSubcommand extends AbstractOsuStatsCompareCommand {}

@Command({
    name: "osustatscompare",
    description: "Compares two players' global leaderboard appearances.",
    aliases: ["oscmp", "osgap"],
    prefixOnly: true,
})
export class OsuStatsCompareCommand extends AbstractOsuStatsCompareCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikoosustatscompare",
    description: "Compares two players' osu!taiko global leaderboard appearances.",
    aliases: ["toscmp", "tosgap"],
    prefixOnly: true,
})
export class TaikoOsuStatsCompareCommand extends AbstractOsuStatsCompareCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchosustatscompare",
    description: "Compares two players' osu!catch global leaderboard appearances.",
    aliases: ["coscmp", "cosgap"],
    prefixOnly: true,
})
export class CatchOsuStatsCompareCommand extends AbstractOsuStatsCompareCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniaosustatscompare",
    description: "Compares two players' osu!mania global leaderboard appearances.",
    aliases: ["moscmp", "mosgap"],
    prefixOnly: true,
})
export class ManiaOsuStatsCompareCommand extends AbstractOsuStatsCompareCommand {
    protected forcedMode = GameMode.Mania;
}
