import { SubcommandGroup } from "@/core/decorators";

@SubcommandGroup({
    root: "osutrack",
    name: "decay",
    description: "Estimates natural global rank decay using osu!track.",
})
export class OsuTrackDecayGroup {}
