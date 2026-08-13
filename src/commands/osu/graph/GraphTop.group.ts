import { SubcommandGroup } from "@/core/decorators";

@SubcommandGroup({
    root: "graph",
    name: "top",
    description: "Graphs based on a player's top plays.",
})
export class GraphTopGroup {}
