import { Subcommand } from "@/core/decorators";
import { AbstractGraphOsuTrackHitsCommand } from "./AbstractGraphOsuTrackHitsCommand";

@Subcommand({
    root: "graph",
    group: "osutrack",
    name: "hits",
    description: "Shows a player's historical hit counts from osu!track.",
})
export class GraphOsuTrackHitsSubcommand extends AbstractGraphOsuTrackHitsCommand {}

// @Command({
//     name: "graphosutrackhits",
//     description: "Shows a player's historical hit counts from osu!track.",
//     aliases: ["gohits"],
//     prefixOnly: true,
// })
// export class GraphOsuTrackHitsCommand extends AbstractGraphOsuTrackHitsCommand {}

// @Category(ECommandCategory.Taiko)
// @Command({
//     name: "taikographosutrackhits",
//     description: "Shows a player's historical osu!taiko hit counts from osu!track.",
//     aliases: ["tgohits"],
//     prefixOnly: true,
// })
// export class TaikoGraphOsuTrackHitsCommand extends AbstractGraphOsuTrackHitsCommand {
//     protected forcedMode = GameMode.Taiko;
// }

// @Category(ECommandCategory.Catch)
// @Command({
//     name: "catchgraphosutrackhits",
//     description: "Shows a player's historical osu!catch hit counts from osu!track.",
//     aliases: ["cgohits"],
//     prefixOnly: true,
// })
// export class CatchGraphOsuTrackHitsCommand extends AbstractGraphOsuTrackHitsCommand {
//     protected forcedMode = GameMode.Catch;
// }

// @Category(ECommandCategory.Mania)
// @Command({
//     name: "maniagraphosutrackhits",
//     description: "Shows a player's historical osu!mania hit counts from osu!track.",
//     aliases: ["mgohits"],
//     prefixOnly: true,
// })
// export class ManiaGraphOsuTrackHitsCommand extends AbstractGraphOsuTrackHitsCommand {
//     protected forcedMode = GameMode.Mania;
// }
