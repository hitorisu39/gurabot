import { Category, Command, Subcommand } from "@/core/decorators";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";
import { AbstractOsuStatsScoresCommand } from "./AbstractOsuStatsScoresCommand";

@Subcommand({
    root: "osustats",
    name: "scores",
    description: "Shows a player's scores appearing on map global leaderboards.",
})
export class OsuStatsScoresSubcommand extends AbstractOsuStatsScoresCommand {}

@Command({
    name: "osustatsscores",
    description: "Shows a player's scores appearing on map global leaderboards.",
    aliases: ["oss"],
    prefixOnly: true,
})
export class OsuStatsScoresCommand extends AbstractOsuStatsScoresCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikoosustatsscores",
    description: "Shows a player's osu!taiko scores appearing on global leaderboards.",
    aliases: ["toss"],
    prefixOnly: true,
})
export class TaikoOsuStatsScoresCommand extends AbstractOsuStatsScoresCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchosustatsscores",
    description: "Shows a player's osu!catch scores appearing on global leaderboards.",
    aliases: ["coss"],
    prefixOnly: true,
})
export class CatchOsuStatsScoresCommand extends AbstractOsuStatsScoresCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniaosustatsscores",
    description: "Shows a player's osu!mania scores appearing on global leaderboards.",
    aliases: ["moss"],
    prefixOnly: true,
})
export class ManiaOsuStatsScoresCommand extends AbstractOsuStatsScoresCommand {
    protected forcedMode = GameMode.Mania;
}
