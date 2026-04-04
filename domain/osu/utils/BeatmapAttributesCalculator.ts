import { ModUtils, ParsedMod } from "@generated/adapter/mods";
import { Beatmap } from "@generated/adapter/types";
import { BeatmapAttributes } from "@generated/calculator/calculator";

export class BeatmapAttributesCalculator {
    public static calculate(beatmap: Beatmap, mods: Array<ParsedMod>): BeatmapAttributes {
        let ar = beatmap.ar;
        let od = beatmap.od;
        let cs = beatmap.cs;
        let hp = beatmap.hp;

        if (ModUtils.has(mods, "HR")) {
            ar = Math.min(ar * 1.4, 10);
            od = Math.min(od * 1.4, 10);
            cs = Math.min(cs * 1.3, 10);
            hp = Math.min(hp * 1.4, 10);
        } else if (ModUtils.has(mods, "EZ")) {
            ar /= 2;
            od /= 2;
            cs /= 2;
            hp /= 2;
        }

        const clockRate = ModUtils.clockRate(mods);

        const preempt = this.difficultyRange(ar, 1800, 1200, 450) / clockRate;
        ar = this.inverseDifficultyRange(preempt, 1800, 1200, 450);

        const hitWindow = this.difficultyRange(od, 80, 50, 20) / clockRate;
        od = this.inverseDifficultyRange(hitWindow, 80, 50, 20);

        return {
            ar,
            od,
            cs,
            hp,
            clockRate,
        };
    }

    public static bpm(bpm: number, clockRate: number): number {
        return bpm * clockRate;
    }

    public static length(length: number, clockRate: number): number {
        return Math.floor(length / clockRate);
    }

    private static difficultyRange(difficulty: number, min: number, mid: number, max: number): number {
        if (difficulty > 5) return mid + ((max - mid) * (difficulty - 5)) / 5;
        if (difficulty < 5) return mid - ((mid - min) * (5 - difficulty)) / 5;
        return mid;
    }

    private static inverseDifficultyRange(time: number, min: number, mid: number, max: number): number {
        if (time > mid) return 5 - ((time - mid) * 5) / (min - mid);
        if (time < mid) return 5 + ((mid - time) * 5) / (mid - max);
        return 5;
    }
}
