import { Status } from "@generated/adapter/types";
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

    public static hasLeaderboard(status: Status): boolean {
        return [Status.Approved, Status.Ranked, Status.Qualified, Status.Loved].includes(status);
    }

    public static awardsPerformancePoints(status: Status): boolean {
        return [Status.Approved, Status.Ranked].includes(status);
    }

    public static isTarget(input: string): boolean {
        const target = BeatmapUtils.normalizeTarget(input);
        return /^\d+$/.test(target) || BeatmapUtils.targetRegexes.some((regex) => regex.test(target));
    }

    public static extractTarget(input: string): IExtractedBeatmapTarget {
        const tokens = input.trim().split(/\s+/).filter(Boolean);

        if (tokens.length === 0) {
            return {
                remainder: "",
            };
        }

        const first = BeatmapUtils.normalizeTarget(tokens[0]!);

        if (!BeatmapUtils.isTarget(first)) {
            return {
                remainder: tokens.join(" "),
            };
        }

        return {
            target: first,
            remainder: tokens.slice(1).join(" "),
        };
    }

    public static bpm(bpm: number, clockRate: number): number {
        return bpm * clockRate;
    }

    public static length(length: number, clockRate: number): number {
        return Math.floor(length / clockRate);
    }

    private static normalizeTarget(input: string): string {
        const trimmed = input.trim();

        if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
            return trimmed.slice(1, -1);
        }

        return trimmed;
    }
}
