import { SubcommandGroup } from "@/core/decorators";

@SubcommandGroup({
    root: "snipe",
    name: "country",
    description: "Country osu! national #1 statistics.",
})
export class SnipeCountryGroup {}
