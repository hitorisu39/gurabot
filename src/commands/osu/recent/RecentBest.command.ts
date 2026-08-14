import { Category, Command, Subcommand } from "@/core/decorators";
import { AbstractTopCommand } from "../top/AbstractTopCommand";
import { EScoreQuerySort } from "@domain/osu/enums/Score.enum";
import { GameMode } from "@generated/adapter/types";
import { ECommandCategory } from "@domain/core/Command";

// Slash
@Subcommand({
    root: "recent",
    name: "best",
    description: "Shows an osu! player's top plays sorted by most recently achieved.",
})
export class RecentBestSubcommand extends AbstractTopCommand {
    protected forcedSort = EScoreQuerySort.Date;
}

@Command({
    name: "recentbest",
    description: "Shows an osu! player's top plays sorted by most recently achieved.",
    prefixOnly: true,
    aliases: ["rb", "bestrecent"],
})
export class RecentBestCommand extends AbstractTopCommand {
    protected forcedSort = EScoreQuerySort.Date;
}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikorecentbest",
    description: "Shows an osu!taiko player's top plays sorted by most recently achieved.",
    prefixOnly: true,
    aliases: ["recenttaikobest", "rbt", "trb", "recentbesttaiko"],
})
export class TaikoRecentBestCommand extends AbstractTopCommand {
    protected forcedMode = GameMode.Taiko;
    protected forcedSort = EScoreQuerySort.Date;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchrecentbest",
    description: "Shows an osu!catch player's top plays sorted by most recently achieved.",
    prefixOnly: true,
    aliases: ["recentcatchbest", "rbc", "crb", "recentbestcatch"],
})
export class CatchRecentBestCommand extends AbstractTopCommand {
    protected forcedMode = GameMode.Catch;
    protected forcedSort = EScoreQuerySort.Date;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniarecentbest",
    description: "Shows an osu!mania player's top plays sorted by most recently achieved.",
    prefixOnly: true,
    aliases: ["recentmaniabest", "rbm", "mrb", "recentbestmania"],
})
export class ManiaRecentBestCommand extends AbstractTopCommand {
    protected forcedMode = GameMode.Mania;
    protected forcedSort = EScoreQuerySort.Date;
}
