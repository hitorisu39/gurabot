import { Beatmap, Status } from "@generated/adapter/types";
import {
    beatmapDefaultRegex,
    beatmapLongRegex,
    beatmapShortRegex,
    mapsetDefaultRegex,
    mapsetShortRegex,
} from "../configs/Beatmap.config";

export interface IExtractedBeatmapTarget {
    target?: string;
    remainder: string;
}

export class BeatmapUtils {
    private static readonly targetRegexes: ReadonlyArray<RegExp> = [
        beatmapLongRegex,
        beatmapDefaultRegex,
        beatmapShortRegex,
        mapsetDefaultRegex,
        mapsetShortRegex,
    ];

    public static hasLeaderboard(beatmap: Pick<Beatmap, "status">): boolean {
        return [Status.Approved, Status.Ranked, Status.Qualified, Status.Loved].includes(beatmap.status);
    }

    public static awardsPerformancePoints(beatmap: Pick<Beatmap, "status">): boolean {
        return [Status.Approved, Status.Ranked].includes(beatmap.status);
    }

    public static isTarget(input: string): boolean {
        const target = this.normalizeTarget(input);
        return /^\d+$/.test(target) || this.targetRegexes.some((regex) => regex.test(target));
    }

    public static extractTarget(input: string): IExtractedBeatmapTarget {
        const tokens = input.trim().split(/\s+/).filter(Boolean);

        if (tokens.length === 0) {
            return {
                remainder: "",
            };
        }

        const first = this.normalizeTarget(tokens[0]!);

        if (!this.isTarget(first)) {
            return {
                remainder: tokens.join(" "),
            };
        }

        return {
            target: first,
            remainder: tokens.slice(1).join(" "),
        };
    }

    private static normalizeTarget(input: string): string {
        const trimmed = input.trim();

        if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
            return trimmed.slice(1, -1);
        }

        return trimmed;
    }
}
