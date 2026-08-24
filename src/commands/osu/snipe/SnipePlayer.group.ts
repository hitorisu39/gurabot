import { SubcommandGroup } from "@/core/decorators";

@SubcommandGroup({
    root: "snipe",
    name: "player",
    description: "Player national #1 statistics.",
})
export class SnipePlayerGroup {}
