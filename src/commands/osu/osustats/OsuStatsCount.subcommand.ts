import { Category, Command, Subcommand } from "@/core/decorators";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";
import { AbstractOsuStatsCountCommand } from "./AbstractOsuStatsCountCommand";

@Subcommand({
    root: "osustats",
    name: "count",
    description: "Shows how often a player appears on map global leaderboards.",
})
export class OsuStatsCountSubcommand extends AbstractOsuStatsCountCommand {}

@Command({
    name: "osustatscount",
    description: "Shows how often a player appears on map global leaderboards.",
    aliases: ["osc"],
    prefixOnly: true,
})
export class OsuStatsCountCommand extends AbstractOsuStatsCountCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikoosustatscount",
    description: "Shows how often a player appears on osu!taiko global leaderboards.",
    aliases: ["tosc"],
    prefixOnly: true,
})
export class TaikoOsuStatsCountCommand extends AbstractOsuStatsCountCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchosustatscount",
    description: "Shows how often a player appears on osu!catch global leaderboards.",
    aliases: ["cosc"],
    prefixOnly: true,
})
export class CatchOsuStatsCountCommand extends AbstractOsuStatsCountCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniaosustatscount",
    description: "Shows how often a player appears on osu!mania global leaderboards.",
    aliases: ["mosc"],
    prefixOnly: true,
})
export class ManiaOsuStatsCountCommand extends AbstractOsuStatsCountCommand {
    protected forcedMode = GameMode.Mania;
}
