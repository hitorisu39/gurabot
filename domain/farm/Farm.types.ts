import { GameMode } from "@generated/adapter/types";

import type { EModMatchType, ICommandDateRange, ICommandMods, ICommandRange } from "@domain/core/Command";

export enum EFarmSort {
    Random = "Random",
    Farmability = "Farmability",
    Stars = "Stars",
    Bpm = "Bpm",
    Length = "Length",
    PP = "PP",
    Ranked = "Ranked",
}

/**
 * Lowercase to match Prisma's type.
 */
export enum EFarmSortOrder {
    Ascending = "asc",
    Descending = "desc",
}

export enum EFarmRecommendSort {
    Random = "Random",
    Farmability = "Farmability",
}

export interface IFarmMapKey {
    beatmapID: number;
    mods: number;
}

export interface IFarmModsQuery {
    type: EModMatchType;
    bits: number;
}

export interface IFarmMapQuery {
    mode: GameMode;
    mods?: IFarmModsQuery | null;
    pp?: ICommandRange | null;
    length?: ICommandRange | null;
    bpm?: ICommandRange | null;
    stars?: ICommandRange | null;
    ranked?: ICommandDateRange | null;
    ar?: ICommandRange | null;
    cs?: ICommandRange | null;
    od?: ICommandRange | null;
    hp?: ICommandRange | null;

    excludeBeatmapIDs?: ReadonlyArray<number>;

    sort?: EFarmSort;
    order?: EFarmSortOrder;
    limit?: number;
    offset?: number;

    randomSeed?: number | null;
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

export interface IFarmMapQueryRow {
    beatmapID: number;
    mapsetID: number;
    version: string;
    mods: number;
    pp: number | null;
    farmability: number;
    stars: number;
    effectiveBpm: number;
    effectiveLength: number;
    rankedAt: Date;
    effectiveAr: number;
    cs: number;
    od: number;
    hp: number;
    mapset: {
        artist: string;
        title: string;
    };
}

export interface IFarmRecommendOverrides {
    pp?: ICommandRange | null;
    length?: ICommandRange | null;
    bpm?: ICommandRange | null;
    stars?: ICommandRange | null;
    ranked?: ICommandDateRange | null;
    ar?: ICommandRange | null;
    cs?: ICommandRange | null;
    od?: ICommandRange | null;
    hp?: ICommandRange | null;
    mods?: ICommandMods | null;
    sort: EFarmRecommendSort;
}
