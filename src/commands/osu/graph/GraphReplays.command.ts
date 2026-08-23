import { Subcommand } from "@/core/decorators";
import { AbstractGraphReplaysCommand } from "./AbstractGraphReplaysCommand";

@Subcommand({
    root: "graph",
    name: "replays",
    description: "Shows a player's replays watched history.",
})
export class GraphReplaysSubcommand extends AbstractGraphReplaysCommand {}

// @Command({
//     name: "graphreplays",
//     description: "Shows a player's replays watched history.",
//     aliases: ["greplays", "greplay", "replaygraph", "replaysgraph"],
//     prefixOnly: true,
// })
// export class GraphReplaysCommand extends AbstractGraphReplaysCommand {}
