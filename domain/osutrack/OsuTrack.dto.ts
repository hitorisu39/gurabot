import { Exclude, Expose, instanceToPlain, Type } from "class-transformer";

@Exclude()
export class OsuTrackPeakDto {
    @Expose({ name: "best_global_rank" })
    declare peakRank: number;

    @Expose({ name: "best_rank_timestamp" })
    @Type(() => Date)
    declare peakRankDate: Date;

    @Expose({ name: "best_accuracy" })
    declare peakAccuracy: number;

    @Expose({ name: "best_acc_timestamp" })
    @Type(() => Date)
    declare peakAccuracyDate: Date;

    toJSON() {
        return instanceToPlain(this, { excludeExtraneousValues: true });
    }
}

@Exclude()
export class OsuTrackStatsHistoryDto {
    @Expose()
    declare count300: number;

    @Expose()
    declare count100: number;

    @Expose()
    declare count50: number;

    @Expose()
    declare playcount: number;

    @Expose({ name: "ranked_score" })
    declare rankedScore: string;

    @Expose({ name: "total_score" })
    declare totalScore: string;

    @Expose({ name: "pp_rank" })
    declare ppRank: number;

    @Expose()
    declare level: number;

    @Expose({ name: "pp_raw" })
    declare pp: number;

    @Expose()
    declare accuracy: number;

    @Expose({ name: "count_rank_ss" })
    declare countRankSS: number;

    @Expose({ name: "count_rank_s" })
    declare countRankS: number;

    @Expose({ name: "count_rank_a" })
    declare countRankA: number;

    @Expose()
    @Type(() => Date)
    declare timestamp: Date;

    toJSON() {
        return instanceToPlain(this, {
            excludeExtraneousValues: true,
        });
    }
}

export type TOsuTrackLadderPoint = [number, number];

@Exclude()
export class OsuTrackLadderSimulationConfigDto {
    @Expose({ name: "rank_to_decay" })
    declare rankToDecay: Array<TOsuTrackLadderPoint>;

    @Expose({ name: "rank_to_density" })
    declare rankToDensity: Array<TOsuTrackLadderPoint>;

    @Expose({ name: "rank_to_pp" })
    declare rankToPp: Array<TOsuTrackLadderPoint>;

    toJSON() {
        return instanceToPlain(this, {
            excludeExtraneousValues: true,
        });
    }
}

export class OsuTrackPeakQueryDto {
    declare user: number | string;
    declare mode: number;
    declare userMode?: string;
}
