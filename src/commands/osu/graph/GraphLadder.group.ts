import { SubcommandGroup } from "@/core/decorators";

@SubcommandGroup({
    root: "graph",
    name: "ladder",
    description: "Graphs global osu! leaderboard statistics.",
})
export class GraphLadderGroup {}
