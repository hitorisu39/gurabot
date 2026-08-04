import { clamp, numberOrUndefined } from "../utils";

export interface AccuracyStatistics {
    miss: number;
    meh: number;
    ok: number;
    good: number;
    great: number;
    perfect: number;
}

export interface CalculatedScoreWeight {
    percentage: number;
    pp: number;
}

export function normalizeAccuracy(value: unknown): number | undefined {
    const accuracy = numberOrUndefined(value);

    if (accuracy === undefined) {
        return undefined;
    }

    const normalized = accuracy > 1 ? accuracy / 100 : accuracy;
    return clamp(normalized, 0, 1);
}

export function calculateAccuracy(mode: number, statistics: AccuracyStatistics): number {
    const { miss, meh, ok, good, great, perfect } = statistics;

    let accuracy: number;

    switch (mode) {
        case 1: {
            const total = great + ok + miss;

            accuracy = total > 0 ? (great + ok * 0.5) / total : 0;
            break;
        }

        case 2: {
            const caught = great + ok + meh;
            const total = caught + good + miss;

            accuracy = total > 0 ? caught / total : 0;
            break;
        }

        case 3: {
            const total = perfect + great + good + ok + meh + miss;

            accuracy = total > 0 ? (perfect * 300 + great * 300 + good * 200 + ok * 100 + meh * 50) / (total * 300) : 0;

            break;
        }

        default: {
            const total = great + ok + meh + miss;

            accuracy = total > 0 ? (great * 300 + ok * 100 + meh * 50) / (total * 300) : 0;
            break;
        }
    }

    return clamp(accuracy, 0, 1);
}

export function calculateScoreWeight(pp: number, index: number): CalculatedScoreWeight {
    const normalizedIndex = Math.max(0, Math.trunc(index));
    const factor = Math.pow(0.95, normalizedIndex);

    return {
        percentage: factor * 100,
        pp: pp * factor,
    };
}
