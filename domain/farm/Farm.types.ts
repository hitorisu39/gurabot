import { GameMode } from "@generated/adapter/types";

export enum EFarmSort {
    Farmability = "Farmability",
    Stars = "Stars",
    Bpm = "Bpm",
    Length = "Length",
    PP = "PP",
    Ranked = "Ranked",
}

export enum EFarmSortOrder {
    Ascending = "asc",
    Descending = "desc",
}

export interface IFarmMapQuery {
    mode: GameMode;
    mods?: ReadonlyArray<number>;

    ppMin?: number;
    ppMax?: number;

    lengthMin?: number;
    lengthMax?: number;

    bpmMin?: number;
    bpmMax?: number;

    starsMin?: number;
    starsMax?: number;

    rankedMin?: Date;
    rankedMax?: Date;

    arMin?: number;
    arMax?: number;

    csMin?: number;
    csMax?: number;

    odMin?: number;
    odMax?: number;

    hpMin?: number;
    hpMax?: number;

    sort?: EFarmSort;
    order?: EFarmSortOrder;

    limit?: number;
    offset?: number;
}

export interface IFarmMapImport {
    beatmapID: number;
    mapsetID: number;
    mods: number;

    farmValue: number;
    farmability: number;

    pp?: number;
    adjusted: number;

    version: string;

    length: number;
    effectiveLength: number;
    effectiveBpm: number;

    stars: number;
    passCount: number;

    ageHours: number;
    rankedAt: Date;

    ar: number;
    effectiveAr: number;

    cs: number;
    od: number;
    hp: number;
}
