import { FarmMapCsvDto } from "@domain/farm/Farm.dto";
import { IFarmMapImport } from "@domain/farm/Farm.types";

const EZ = 2;
const HR = 16;
const DT = 64;
const HT = 256;

export function getFarmability(farmValue: number, adjusted: number, ageHours: number): number {
    return (1_000 * farmValue) / Math.pow(adjusted || 1, 0.65) / Math.pow(ageHours || 1, 0.35);
}

export function getFarmSpeedRate(mods: number): number {
    if ((mods & DT) === DT) {
        return 1.5;
    }

    if ((mods & HT) === HT) {
        return 0.75;
    }

    return 1;
}

export function getFarmEffectiveAr(ar: number, mods: number): number {
    let moddedAr = ar;

    if ((mods & HR) === HR) {
        moddedAr *= 1.4;
    } else if ((mods & EZ) === EZ) {
        moddedAr *= 0.5;
    }

    const speedRate = getFarmSpeedRate(mods);
    if (moddedAr === ar && speedRate === 1) {
        return ar;
    }

    const approachTime = moddedAr > 5 ? 1_200 - 150 * (moddedAr - 5) : 1_200 + 120 * (5 - moddedAr);
    const effectiveApproachTime = approachTime / speedRate;

    if (effectiveApproachTime < 300) {
        return 11;
    }

    if (effectiveApproachTime < 1_200) {
        return Math.round((11 - (effectiveApproachTime - 300) / 150) * 100) / 100;
    }

    return Math.round((5 - (effectiveApproachTime - 1_200) / 120) * 100) / 100;
}

export function normalizeFarmMap(map: FarmMapCsvDto, bpm: number): IFarmMapImport {
    const speedRate = getFarmSpeedRate(map.mods);

    return {
        beatmapID: map.beatmapID,
        mapsetID: map.mapsetID,
        mods: map.mods,

        farmValue: map.farmValue,
        farmability: getFarmability(map.farmValue, map.adjusted, map.ageHours),

        pp: map.pp,
        adjusted: map.adjusted,
        version: map.version,

        length: map.length,
        effectiveLength: map.length / speedRate,
        effectiveBpm: bpm * speedRate,

        stars: map.stars,
        passCount: map.passCount,

        ageHours: map.ageHours,
        rankedAt: new Date(map.rankedHours * 60 * 60 * 1_000),

        ar: map.ar,
        effectiveAr: getFarmEffectiveAr(map.ar, map.mods),

        cs: map.cs,
        od: map.accuracy,
        hp: map.drain,
    };
}
