import { Exclude, Expose, instanceToPlain, Type } from "class-transformer";

@Exclude()
export class AmeobeaPeakDto {
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

export class AmeobeaPeakQueryDto {
    declare user: number | string;
    declare mode: number;
    declare userMode?: string;
}
