import { FarmMapsetCsvDto } from "@domain/farm/Farm.dto";
import { EFarmSort, EFarmSortOrder, IFarmMapImport, IFarmMapQuery } from "@domain/farm/Farm.types";
import type { Prisma } from "@generated/prisma/client";

const range = (min?: number, max?: number) => {
    return {
        ...(min !== undefined ? { gte: min } : {}),
        ...(max !== undefined ? { lte: max } : {}),
    };
};

const getFarmMapOrder = (sort: EFarmSort, direction: EFarmSortOrder): Prisma.FarmMapOrderByWithRelationInput => {
    switch (sort) {
        case EFarmSort.Farmability:
            return { farmability: direction };
        case EFarmSort.Stars:
            return { stars: direction };
        case EFarmSort.Bpm:
            return { effectiveBpm: direction };
        case EFarmSort.Length:
            return { effectiveLength: direction };
        case EFarmSort.PP:
            return {
                pp: {
                    sort: direction,
                    nulls: "last",
                },
            };
        case EFarmSort.Ranked:
            return { rankedAt: direction };
    }
};

const farmMapSelect = {
    beatmapID: true,
    mapsetID: true,

    version: true,
    mods: true,

    pp: true,
    farmability: true,

    stars: true,

    effectiveBpm: true,
    effectiveLength: true,

    rankedAt: true,

    effectiveAr: true,

    cs: true,
    od: true,
    hp: true,

    mapset: {
        select: {
            artist: true,
            title: true,
        },
    },
} satisfies Prisma.FarmMapSelect;

export const getFarmDatasetQuery = (mode: number) => {
    return {
        where: {
            mode,
        },
        select: {
            snapshotID: true,
            checkedAt: true,
            snapshot: {
                select: {
                    sourceUpdatedAt: true,
                },
            },
        },
    } satisfies Prisma.FarmDatasetFindUniqueArgs;
};

export const getFarmMapsQuery = (snapshotID: number, query: IFarmMapQuery) => {
    const sort = query.sort ?? EFarmSort.Farmability;
    const direction = query.order ?? EFarmSortOrder.Descending;

    return {
        where: {
            snapshotID,

            ...(query.mods?.length
                ? {
                      mods: {
                          in: [...query.mods],
                      },
                  }
                : {}),

            ...(query.ppMin !== undefined || query.ppMax !== undefined
                ? {
                      pp: range(query.ppMin, query.ppMax),
                  }
                : {}),

            ...(query.lengthMin !== undefined || query.lengthMax !== undefined
                ? {
                      effectiveLength: range(query.lengthMin, query.lengthMax),
                  }
                : {}),

            ...(query.bpmMin !== undefined || query.bpmMax !== undefined
                ? {
                      effectiveBpm: range(query.bpmMin, query.bpmMax),
                  }
                : {}),

            ...(query.starsMin !== undefined || query.starsMax !== undefined
                ? {
                      stars: range(query.starsMin, query.starsMax),
                  }
                : {}),

            ...(query.arMin !== undefined || query.arMax !== undefined
                ? {
                      effectiveAr: range(query.arMin, query.arMax),
                  }
                : {}),

            ...(query.csMin !== undefined || query.csMax !== undefined
                ? {
                      cs: range(query.csMin, query.csMax),
                  }
                : {}),

            ...(query.odMin !== undefined || query.odMax !== undefined
                ? {
                      od: range(query.odMin, query.odMax),
                  }
                : {}),

            ...(query.hpMin !== undefined || query.hpMax !== undefined
                ? {
                      hp: range(query.hpMin, query.hpMax),
                  }
                : {}),

            ...(query.rankedMin || query.rankedMax
                ? {
                      rankedAt: {
                          ...(query.rankedMin
                              ? {
                                    gte: query.rankedMin,
                                }
                              : {}),

                          ...(query.rankedMax
                              ? {
                                    lte: query.rankedMax,
                                }
                              : {}),
                      },
                  }
                : {}),
        },

        orderBy: [
            getFarmMapOrder(sort, direction),

            {
                beatmapID: "asc",
            },

            {
                mods: "asc",
            },
        ],

        take: Math.min(Math.max(query.limit ?? 20, 1), 100),

        skip: Math.max(query.offset ?? 0, 0),

        select: farmMapSelect,
    } satisfies Prisma.FarmMapFindManyArgs;
};

export const getCreateFarmSnapshotQuery = (mode: number, sourceUpdatedAt: Date) => {
    return {
        data: {
            mode,
            sourceUpdatedAt,
        },
    } satisfies Prisma.FarmSnapshotCreateArgs;
};

export const getFinalizeFarmSnapshotQuery = (snapshotID: number, mapsetCount: number, mapCount: number) => {
    return {
        where: {
            id: snapshotID,
        },
        data: {
            mapsetCount,
            mapCount,
        },
    } satisfies Prisma.FarmSnapshotUpdateArgs;
};

export const getActivateFarmDatasetQuery = (mode: number, snapshotID: number, checkedAt: Date) => {
    return {
        where: {
            mode,
        },
        create: {
            mode,
            checkedAt,
            snapshot: {
                connect: {
                    id: snapshotID,
                },
            },
        },
        update: {
            checkedAt,
            snapshot: {
                connect: {
                    id: snapshotID,
                },
            },
        },
    } satisfies Prisma.FarmDatasetUpsertArgs;
};

export const getUpdateFarmCheckedAtQuery = (mode: number, checkedAt: Date) => {
    return {
        where: {
            mode,
        },
        data: {
            checkedAt,
        },
    } satisfies Prisma.FarmDatasetUpdateArgs;
};

export const getDeleteFarmSnapshotQuery = (snapshotID: number) => {
    return {
        where: {
            id: snapshotID,
        },
    } satisfies Prisma.FarmSnapshotDeleteArgs;
};

export const getDeleteInactiveFarmSnapshotsQuery = (mode: number, activeSnapshotID?: number) => {
    return {
        where: {
            mode,
            ...(activeSnapshotID !== undefined && {
                id: {
                    not: activeSnapshotID,
                },
            }),
        },
    } satisfies Prisma.FarmSnapshotDeleteManyArgs;
};

export const getCreateFarmMapsetsQuery = (snapshotID: number, mapsets: ReadonlyArray<FarmMapsetCsvDto>) => {
    return {
        data: mapsets.map((mapset) => ({
            snapshotID,
            mapsetID: mapset.mapsetID,
            artist: mapset.artist,
            title: mapset.title,
            bpm: mapset.bpm,
        })),
    } satisfies Prisma.FarmMapsetCreateManyArgs;
};

export const getFarmMapsetsForImportQuery = (snapshotID: number, mapsetIDs: ReadonlyArray<number>) => {
    return {
        where: {
            snapshotID,
            mapsetID: {
                in: [...mapsetIDs],
            },
        },
        select: {
            mapsetID: true,
            bpm: true,
        },
    } satisfies Prisma.FarmMapsetFindManyArgs;
};

export const getCreateFarmMapsQuery = (snapshotID: number, maps: ReadonlyArray<IFarmMapImport>) => {
    return {
        data: maps.map((map) => ({
            snapshotID,
            ...map,
            pp: map.pp ?? null,
        })),
    } satisfies Prisma.FarmMapCreateManyArgs;
};
