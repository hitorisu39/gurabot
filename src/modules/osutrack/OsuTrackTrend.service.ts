import { AbstractService } from "@/core/framework/AbstractService";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { EOsuTrackTrendConfidence } from "@domain/osutrack/enums/OsuTrackTrend.enum";
import { OsuTrackStatsHistoryDto } from "@domain/osutrack/OsuTrack.dto";
import { OsuTrackPpTrendDto } from "@domain/osutrack/OsuTrackTrend.dto";

interface IPpTrendPoint {
    timestamp: number;
    pp: number;
}

export class OsuTrackTrendService extends AbstractService {
    private readonly dayMs = 24 * 60 * 60 * 1000;

    /*
     * Older points are allowed to contribute, but recent progression
     * should dominate the estimate.
     */
    private readonly lookbackDays = 365;
    private readonly halfLifeDays = 60;

    public calculatePp(history: ReadonlyArray<OsuTrackStatsHistoryDto>): OsuTrackPpTrendDto {
        const points = this.normalizeHistory(history);

        const latest = points.at(-1);

        if (!latest) {
            throw new Exception(EApplicationError.NOT_FOUND, "No usable osu!track PP history is available.");
        }

        const cutoff = latest.timestamp - this.lookbackDays * this.dayMs;
        const recent = points.filter((point) => point.timestamp >= cutoff);
        const first = recent.at(0);

        if (!first || recent.length < 2) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                "There is not enough osu!track history to estimate a PP progression rate.",
            );
        }

        const spanDays = (latest.timestamp - first.timestamp) / this.dayMs;

        if (spanDays < 7) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                "There is not enough osu!track history to estimate a reliable PP progression rate.",
            );
        }

        /*
         * Weighted linear regression.
         *
         * x = elapsed days relative to latest snapshot.
         * y = PP.
         *
         * A point 60 days old contributes half as much weight as the
         * latest point, 120 days old contributes one quarter, etc.
         */
        let weightSum = 0;
        let weightedX = 0;
        let weightedY = 0;

        const weightedPoints = recent.map((point) => {
            const x = (point.timestamp - latest.timestamp) / this.dayMs;
            const ageDays = -x;

            const weight = Math.pow(0.5, ageDays / this.halfLifeDays);

            weightSum += weight;
            weightedX += weight * x;
            weightedY += weight * point.pp;

            return {
                x,
                y: point.pp,
                weight,
            };
        });

        if (weightSum <= 0) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "Could not calculate an osu!track PP trend.");
        }

        const meanX = weightedX / weightSum;
        const meanY = weightedY / weightSum;

        let covariance = 0;
        let variance = 0;

        for (const point of weightedPoints) {
            const dx = point.x - meanX;
            const dy = point.y - meanY;

            covariance += point.weight * dx * dy;
            variance += point.weight * dx * dx;
        }

        if (variance <= 0) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                "There is not enough variation in osu!track history to estimate a PP progression rate.",
            );
        }

        let ppPerDay = covariance / variance;

        /*
         * Avoid tiny floating-point slopes being displayed as meaningful
         * progression.
         */
        if (Math.abs(ppPerDay) < 0.0001) {
            ppPerDay = 0;
        }

        return {
            ppPerDay,
            ppPerMonth: ppPerDay * 30.4375,

            sampleCount: recent.length,
            spanDays,

            firstDate: new Date(first.timestamp),
            latestDate: new Date(latest.timestamp),

            confidence: this.calculateConfidence(recent.length, spanDays),
        };
    }

    private normalizeHistory(history: ReadonlyArray<OsuTrackStatsHistoryDto>): Array<IPpTrendPoint> {
        const byTimestamp = new Map<number, IPpTrendPoint>();

        for (const entry of history) {
            const timestamp = entry.timestamp.getTime();
            const pp = Number(entry.pp);

            if (!Number.isFinite(timestamp) || !Number.isFinite(pp) || pp < 0) {
                continue;
            }

            byTimestamp.set(timestamp, {
                timestamp,
                pp,
            });
        }

        return Array.from(byTimestamp.values()).sort((a, b) => a.timestamp - b.timestamp);
    }

    private calculateConfidence(sampleCount: number, spanDays: number): EOsuTrackTrendConfidence {
        if (sampleCount >= 12 && spanDays >= 120) {
            return EOsuTrackTrendConfidence.High;
        }

        if (sampleCount >= 6 && spanDays >= 45) {
            return EOsuTrackTrendConfidence.Medium;
        }

        return EOsuTrackTrendConfidence.Low;
    }
}
