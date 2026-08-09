import { Command, Subcommand } from "@/core/decorators";
import { AbstractTopCommand } from "../top/AbstractTopCommand";
import { EScoreQuerySort } from "@domain/osu/enums/Score.enum";
import { GameMode } from "@generated/adapter/types";

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

// Taiko

@Command({
    name: "recentbesttaiko",
    description: "Shows an osu!taiko player's top plays sorted by most recently achieved.",
    prefixOnly: true,
    aliases: ["recenttaikobest", "rbt", "trb"],
})
export class RecentBestTaikoCommand extends AbstractTopCommand {
    protected forcedMode = GameMode.Taiko;
    protected forcedSort = EScoreQuerySort.Date;
}

// Catch

@Command({
    name: "recentbestcatch",
    description: "Shows an osu!catch player's top plays sorted by most recently achieved.",
    prefixOnly: true,
    aliases: ["recentcatchbest", "rbc", "crb"],
})
export class RecentBestCatchCommand extends AbstractTopCommand {
    protected forcedMode = GameMode.Catch;
    protected forcedSort = EScoreQuerySort.Date;
}

// Mania

@Command({
    name: "recentbestmania",
    description: "Shows an osu!mania player's top plays sorted by most recently achieved.",
    prefixOnly: true,
    aliases: ["recentmaniabest", "rbm", "mrb"],
})
export class RecentBestManiaCommand extends AbstractTopCommand {
    protected forcedMode = GameMode.Mania;
    protected forcedSort = EScoreQuerySort.Date;
}
