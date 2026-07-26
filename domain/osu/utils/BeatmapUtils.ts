import { Beatmap, Status } from "@generated/adapter/types";

export class BeatmapUtils {
    public static hasLeaderboard(beatmap: Pick<Beatmap, "status">): boolean {
        return [Status.Approved, Status.Ranked, Status.Qualified, Status.Loved].includes(beatmap.status);
    }

    public static awardsPerformancePoints(beatmap: Pick<Beatmap, "status">): boolean {
        return [Status.Approved, Status.Ranked].includes(beatmap.status);
    }
}
