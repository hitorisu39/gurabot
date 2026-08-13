import { SubcommandGroup } from "@/core/decorators";

@SubcommandGroup({
    root: "graph",
    name: "osutrack",
    description: "Graphs historical player statistics from osu!track.",
})
export class GraphOsuTrackGroup {}
