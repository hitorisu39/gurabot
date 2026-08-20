import { Category, Command, Subcommand } from "@/core/decorators";
import { AbstractOsuStatsPlayersCommand } from "./AbstractOsuStatsPlayersCommand";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";

@Subcommand({
    root: "osustats",
    name: "players",
    description: "Ranks players by their global leaderboard appearances.",
})
export class OsuStatsPlayersSubcommand extends AbstractOsuStatsPlayersCommand {}

@Command({
    name: "osustatsplayers",
    description: "Ranks players by their global leaderboard appearances.",
    aliases: ["osp"],
    prefixOnly: true,
})
export class OsuStatsPlayersCommand extends AbstractOsuStatsPlayersCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikoosustatsplayers",
    description: "Ranks players by their osu!taiko global leaderboard appearances.",
    aliases: ["tosp"],
    prefixOnly: true,
})
export class TaikoOsuStatsPlayersCommand extends AbstractOsuStatsPlayersCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchosustatsplayers",
    description: "Ranks players by their osu!catch global leaderboard appearances.",
    aliases: ["cosp"],
    prefixOnly: true,
})
export class CatchOsuStatsPlayersCommand extends AbstractOsuStatsPlayersCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniaosustatsplayers",
    description: "Ranks players by their osu!mania global leaderboard appearances.",
    aliases: ["mosp"],
    prefixOnly: true,
})
export class ManiaOsuStatsPlayersCommand extends AbstractOsuStatsPlayersCommand {
    protected forcedMode = GameMode.Mania;
}
