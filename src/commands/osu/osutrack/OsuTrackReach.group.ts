import { SubcommandGroup } from "@/core/decorators";

@SubcommandGroup({
    root: "osutrack",
    name: "reach",
    description: "Estimates future PP and rank milestones from osu!track history.",
})
export class OsuTrackReachGroup {}
