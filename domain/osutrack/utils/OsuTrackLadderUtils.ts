import { TOsuTrackLadderPoint } from "../OsuTrack.dto";

export class OsuTrackLadderUtils {
    public static readonly decayOversample = 50;
    public static readonly simulationOversample = 50;

    public static interpolate(target: number, data: ReadonlyArray<TOsuTrackLadderPoint>) {
        const first = data.at(0);
        const last = data.at(-1);

        if (!first || !last) {
            return 0;
        }

        if (target <= first[0]) {
            return first[1];
        }

        if (target >= last[0]) {
            return last[1];
        }

        let low = 0;
        let high = data.length - 1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const point = data.at(mid);

            if (!point) {
                break;
            }

            const [rank, value] = point;

            if (rank < target) {
                low = mid + 1;
            } else if (rank > target) {
                high = mid - 1;
            } else {
                return value;
            }
        }

        const lower = data.at(high);
        const upper = data.at(low);

        if (!lower || !upper) {
            return first[1];
        }

        const [lowerRank, lowerValue] = lower;
        const [upperRank, upperValue] = upper;

        const range = upperRank - lowerRank;

        if (range === 0) {
            return lowerValue;
        }

        const t = (target - lowerRank) / range;
        return lowerValue + (upperValue - lowerValue) * t;
    }

    public static projectRankDecay(
        currentRank: number,
        days: number,
        decay: ReadonlyArray<TOsuTrackLadderPoint>,
    ): number {
        let rank = currentRank;

        const steps = Math.ceil(days * OsuTrackLadderUtils.decayOversample);
        const stepDuration = days / steps;

        for (let step = 0; step < steps; step++) {
            const dailyDecay = OsuTrackLadderUtils.interpolate(rank, decay);

            if (!Number.isFinite(dailyDecay) || dailyDecay <= 0) {
                break;
            }

            rank += dailyDecay * stepDuration;
        }

        return Math.round(rank);
    }

    public static calculateDecayDays(
        currentRank: number,
        targetRank: number,
        decay: ReadonlyArray<TOsuTrackLadderPoint>,
        maxDays = 36525,
    ): number | null {
        if (targetRank <= currentRank) {
            return 0;
        }

        let rank = currentRank;

        const stepDuration = 1 / OsuTrackLadderUtils.decayOversample;
        const maxSteps = Math.ceil(maxDays * OsuTrackLadderUtils.decayOversample);

        for (let step = 0; step < maxSteps; step++) {
            const dailyDecay = OsuTrackLadderUtils.interpolate(rank, decay);

            if (!Number.isFinite(dailyDecay) || dailyDecay <= 0) {
                return null;
            }

            rank += dailyDecay * stepDuration;

            if (rank >= targetRank) {
                return (step + 1) * stepDuration;
            }
        }

        return null;
    }

    public static projectRankWithPace(
        currentRank: number,
        ppPerDay: number,
        days: number,
        decay: ReadonlyArray<TOsuTrackLadderPoint>,
        density: ReadonlyArray<TOsuTrackLadderPoint>,
    ): number {
        let rank = currentRank;

        const steps = Math.ceil(days * OsuTrackLadderUtils.simulationOversample);
        if (steps <= 0) {
            return Math.round(rank);
        }

        const stepDuration = days / steps;

        for (let step = 0; step < steps; step++) {
            const dailyDecay = OsuTrackLadderUtils.interpolate(rank, decay);
            const rankDensity = OsuTrackLadderUtils.interpolate(rank, density);
            const rankMovement = dailyDecay - ppPerDay * rankDensity;

            rank += rankMovement * stepDuration;
            rank = Math.max(1, rank);
        }

        return Math.round(rank);
    }

    public static calculateReachRankDays(
        currentRank: number,
        targetRank: number,
        ppPerDay: number,
        decay: ReadonlyArray<TOsuTrackLadderPoint>,
        density: ReadonlyArray<TOsuTrackLadderPoint>,
        maxDays: number,
    ): number | null {
        if (targetRank >= currentRank) {
            return 0;
        }

        let rank = currentRank;

        const stepDuration = 1 / OsuTrackLadderUtils.simulationOversample;
        const maxSteps = Math.ceil(maxDays * OsuTrackLadderUtils.simulationOversample);

        for (let step = 0; step < maxSteps; step++) {
            const dailyDecay = OsuTrackLadderUtils.interpolate(rank, decay);
            const rankDensity = OsuTrackLadderUtils.interpolate(rank, density);

            if (!Number.isFinite(dailyDecay) || !Number.isFinite(rankDensity)) {
                return null;
            }

            rank += (dailyDecay - ppPerDay * rankDensity) * stepDuration;
            rank = Math.max(1, rank);

            if (rank <= targetRank) {
                return (step + 1) * stepDuration;
            }
        }

        return null;
    }
}
