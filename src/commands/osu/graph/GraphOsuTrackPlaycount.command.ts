import { Subcommand } from "@/core/decorators";
import { AbstractGraphOsuTrackPlaycountCommand } from "./AbstractGraphOsuTrackPlaycountCommand";

@Subcommand({
    root: "graph",
    group: "osutrack",
    name: "playcount",
    description: "Shows a player's historical playcount progression from osu!track.",
})
export class GraphOsuTrackPlaycountSubcommand extends AbstractGraphOsuTrackPlaycountCommand {}

// @Command({
//     name: "graphosutrackplaycount",
//     description: "Shows a player's historical playcount progression from osu!track.",
//     aliases: ["gopc"],
//     prefixOnly: true,
// })
// export class GraphOsuTrackPlaycountCommand extends AbstractGraphOsuTrackPlaycountCommand {}

// @Category(ECommandCategory.Taiko)
// @Command({
//     name: "taikographosutrackplaycount",
//     description: "Shows a player's historical osu!taiko playcount progression from osu!track.",
//     aliases: ["tgopc"],
//     prefixOnly: true,
// })
// export class TaikoGraphOsuTrackPlaycountCommand extends AbstractGraphOsuTrackPlaycountCommand {
//     protected forcedMode = GameMode.Taiko;
// }

// @Category(ECommandCategory.Catch)
// @Command({
//     name: "catchgraphosutrackplaycount",
//     description: "Shows a player's historical osu!catch playcount progression from osu!track.",
//     aliases: ["cgopc"],
//     prefixOnly: true,
// })
// export class CatchGraphOsuTrackPlaycountCommand extends AbstractGraphOsuTrackPlaycountCommand {
//     protected forcedMode = GameMode.Catch;
// }

// @Category(ECommandCategory.Mania)
// @Command({
//     name: "maniagraphosutrackplaycount",
//     description: "Shows a player's historical osu!mania playcount progression from osu!track.",
//     aliases: ["mgopc"],
//     prefixOnly: true,
// })
// export class ManiaGraphOsuTrackPlaycountCommand extends AbstractGraphOsuTrackPlaycountCommand {
//     protected forcedMode = GameMode.Mania;
// }
