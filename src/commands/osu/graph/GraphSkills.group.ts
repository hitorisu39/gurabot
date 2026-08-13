import { SubcommandGroup } from "@/core/decorators";

@SubcommandGroup({
    root: "graph",
    name: "skills",
    description: "Graphs based on a player's calculated skill statistics.",
})
export class GraphSkillsGroup {}
