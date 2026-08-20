import { Category, Command, Subcommand } from "@/core/decorators";
import { AbstractOsuStatsBestCommand } from "./AbstractOsuStatsBestCommand";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";

@Subcommand({
    root: "osustats",
    name: "best",
    description: "Shows the best recent global leaderboard scores.",
})
export class OsuStatsBestSubcommand extends AbstractOsuStatsBestCommand {}

@Command({
    name: "osustatsbest",
    description: "Shows the best recent global leaderboard scores.",
    aliases: ["osb"],
    prefixOnly: true,
})
export class OsuStatsBestCommand extends AbstractOsuStatsBestCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikoosustatsbest",
    description: "Shows the best recent osu!taiko global leaderboard scores.",
    aliases: ["tosb"],
    prefixOnly: true,
})
export class TaikoOsuStatsBestCommand extends AbstractOsuStatsBestCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchosustatsbest",
    description: "Shows the best recent osu!catch global leaderboard scores.",
    aliases: ["cosb"],
    prefixOnly: true,
})
export class CatchOsuStatsBestCommand extends AbstractOsuStatsBestCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniaosustatsbest",
    description: "Shows the best recent osu!mania global leaderboard scores.",
    aliases: ["mosb"],
    prefixOnly: true,
})
export class ManiaOsuStatsBestCommand extends AbstractOsuStatsBestCommand {
    protected forcedMode = GameMode.Mania;
}
