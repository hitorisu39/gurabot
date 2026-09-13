import { FarmMapsetCsvDto } from "@domain/farm/Farm.dto";
import { EFarmSort, EFarmSortOrder, IFarmMapImport, IFarmMapQuery } from "@domain/farm/Farm.types";
import { EModMatchType, ICommandDateRange, ICommandRange } from "@domain/core/Command";
import { Prisma } from "@generated/prisma/client";
import { isValidNumber } from "@domain/utils/utils";

function addNumberRange(conditions: Array<Prisma.Sql>, column: Prisma.Sql, range?: ICommandRange | null): void {
    if (!range) return;

    if (range.exact !== undefined && isValidNumber(range.exact)) {
        conditions.push(Prisma.sql`${column} = ${range.exact}`);
        return;
    }

    if (isValidNumber(range.min)) {
        conditions.push(
            range.minInclusive ? Prisma.sql`${column} >= ${range.min}` : Prisma.sql`${column} > ${range.min}`,
        );
    }

    if (isValidNumber(range.max)) {
        conditions.push(
            range.maxInclusive ? Prisma.sql`${column} <= ${range.max}` : Prisma.sql`${column} < ${range.max}`,
        );
    }
}

function addDateRange(conditions: Array<Prisma.Sql>, column: Prisma.Sql, range?: ICommandDateRange | null): void {
    if (!range) return;

    if (range.exact) {
        conditions.push(Prisma.sql`${column} = ${range.exact}`);
        return;
    }

    if (range.min) {
        conditions.push(
            range.minInclusive ? Prisma.sql`${column} >= ${range.min}` : Prisma.sql`${column} > ${range.min}`,
        );
    }

    if (range.max) {
        conditions.push(
            range.maxInclusive ? Prisma.sql`${column} <= ${range.max}` : Prisma.sql`${column} < ${range.max}`,
        );
    }
}

function addMods(conditions: Array<Prisma.Sql>, query: IFarmMapQuery): void {
    if (!query.mods) return;

    const { type, bits } = query.mods;

    switch (type) {
        case EModMatchType.Match:
            conditions.push(Prisma.sql`m.mods = ${bits}`);
            return;
        case EModMatchType.Include:
            conditions.push(bits === 0 ? Prisma.sql`m.mods = 0` : Prisma.sql`(m.mods & ${bits}) = ${bits}`);
            return;
        case EModMatchType.Exclude:
            conditions.push(bits === 0 ? Prisma.sql`m.mods <> 0` : Prisma.sql`(m.mods & ${bits}) = 0`);
            return;
    }
}

function getFarmMapConditions(snapshotID: number, query: IFarmMapQuery): Array<Prisma.Sql> {
    const conditions: Array<Prisma.Sql> = [Prisma.sql`m.snapshot_id = ${snapshotID}`];

    addMods(conditions, query);
    addNumberRange(conditions, Prisma.sql`m.pp`, query.pp);
    addNumberRange(conditions, Prisma.sql`m.effective_length`, query.length);
    addNumberRange(conditions, Prisma.sql`m.effective_bpm`, query.bpm);
    addNumberRange(conditions, Prisma.sql`m.stars`, query.stars);
    addDateRange(conditions, Prisma.sql`m.ranked_at`, query.ranked);
    addNumberRange(conditions, Prisma.sql`m.effective_ar`, query.ar);
    addNumberRange(conditions, Prisma.sql`m.cs`, query.cs);
    addNumberRange(conditions, Prisma.sql`m.od`, query.od);
    addNumberRange(conditions, Prisma.sql`m.hp`, query.hp);

    if (query.excludeBeatmapIDs?.length) {
        conditions.push(Prisma.sql`m.beatmap_id NOT IN (${Prisma.join(query.excludeBeatmapIDs)})`);
    }

    return conditions;
}

function getFarmOrder(sort: EFarmSort, order: EFarmSortOrder, randomSeed?: number | null): Prisma.Sql {
    if (sort === EFarmSort.Random) {
        if (isValidNumber(randomSeed)) {
            return Prisma.sql`
                md5(
                    concat_ws(
                        ':',
                        m.beatmap_id::text,
                        m.mods::text,
                        ${randomSeed}::text
                    )
                ) ASC
            `;
        }

        return Prisma.sql`RANDOM()`;
    }

    const direction = order === EFarmSortOrder.Ascending ? Prisma.sql`ASC` : Prisma.sql`DESC`;

    switch (sort) {
        case EFarmSort.Farmability:
            return Prisma.sql`m.farmability ${direction}, m.beatmap_id ASC, m.mods ASC`;
        case EFarmSort.Stars:
            return Prisma.sql`m.stars ${direction}, m.beatmap_id ASC, m.mods ASC`;
        case EFarmSort.Bpm:
            return Prisma.sql`m.effective_bpm ${direction}, m.beatmap_id ASC, m.mods ASC`;
        case EFarmSort.Length:
            return Prisma.sql`m.effective_length ${direction}, m.beatmap_id ASC, m.mods ASC`;
        case EFarmSort.PP:
            return Prisma.sql`m.pp ${direction} NULLS LAST, m.beatmap_id ASC, m.mods ASC`;
        case EFarmSort.Ranked:
            return Prisma.sql`m.ranked_at ${direction}, m.beatmap_id ASC, m.mods ASC`;
        default:
            return Prisma.sql`m.farmability DESC, m.beatmap_id ASC, m.mods ASC`;
    }
}

export function getFarmMapsQuery(snapshotID: number, query: IFarmMapQuery): Prisma.Sql {
    const conditions = getFarmMapConditions(snapshotID, query);
    const sort = query.sort ?? EFarmSort.Farmability;
    const order = query.order ?? EFarmSortOrder.Descending;
    const orderBy = getFarmOrder(sort, order);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);

    return Prisma.sql`
        SELECT
            m.beatmap_id       AS "beatmapID",
            m.mapset_id        AS "mapsetID",
            m.version,
            m.mods,
            m.pp,
            m.farmability,
            m.stars,
            m.effective_bpm    AS "effectiveBpm",
            m.effective_length AS "effectiveLength",
            m.ranked_at        AS "rankedAt",
            m.effective_ar     AS "effectiveAr",
            m.cs,
            m.od,
            m.hp,
            json_build_object(
                'artist', s.artist,
                'title', s.title
            ) AS "mapset"
        FROM farm_maps m
        INNER JOIN farm_mapsets s
            ON s.snapshot_id = m.snapshot_id
            AND s.mapset_id = m.mapset_id
        WHERE ${Prisma.join(conditions, " AND ")}
        ORDER BY ${orderBy}
        LIMIT ${limit}
        OFFSET ${offset}
    `;
}

export function getFarmDatasetQuery(mode: number) {
    return {
        where: { mode },
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
}

export function getCreateFarmSnapshotQuery(mode: number, sourceUpdatedAt: Date) {
    return {
        data: {
            mode,
            sourceUpdatedAt,
        },
    } satisfies Prisma.FarmSnapshotCreateArgs;
}

export function getFinalizeFarmSnapshotQuery(snapshotID: number, mapsetCount: number, mapCount: number) {
    return {
        where: { id: snapshotID },
        data: {
            mapsetCount,
            mapCount,
        },
    } satisfies Prisma.FarmSnapshotUpdateArgs;
}

export function getActivateFarmDatasetQuery(mode: number, snapshotID: number, checkedAt: Date) {
    return {
        where: { mode },
        create: {
            mode,
            checkedAt,
            snapshot: {
                connect: { id: snapshotID },
            },
        },
        update: {
            checkedAt,
            snapshot: {
                connect: { id: snapshotID },
            },
        },
    } satisfies Prisma.FarmDatasetUpsertArgs;
}

export function getUpdateFarmCheckedAtQuery(mode: number, checkedAt: Date) {
    return {
        where: { mode },
        data: { checkedAt },
    } satisfies Prisma.FarmDatasetUpdateArgs;
}

export function getDeleteFarmSnapshotQuery(snapshotID: number) {
    return {
        where: { id: snapshotID },
    } satisfies Prisma.FarmSnapshotDeleteArgs;
}

export function getDeleteInactiveFarmSnapshotsQuery(mode: number, activeSnapshotID?: number) {
    return {
        where: {
            mode,
            ...(activeSnapshotID !== undefined
                ? {
                      id: { not: activeSnapshotID },
                  }
                : {}),
        },
    } satisfies Prisma.FarmSnapshotDeleteManyArgs;
}

export function getCreateFarmMapsetsQuery(snapshotID: number, mapsets: ReadonlyArray<FarmMapsetCsvDto>) {
    return {
        data: mapsets.map((mapset) => ({
            snapshotID,
            mapsetID: mapset.mapsetID,
            artist: mapset.artist,
            title: mapset.title,
            bpm: mapset.bpm,
        })),
    } satisfies Prisma.FarmMapsetCreateManyArgs;
}

export function getFarmMapsetsForImportQuery(snapshotID: number, mapsetIDs: ReadonlyArray<number>) {
    return {
        where: {
            snapshotID,
            mapsetID: { in: [...mapsetIDs] },
        },
        select: {
            mapsetID: true,
            bpm: true,
        },
    } satisfies Prisma.FarmMapsetFindManyArgs;
}

export function getCreateFarmMapsQuery(snapshotID: number, maps: ReadonlyArray<IFarmMapImport>) {
    return {
        data: maps.map((map) => ({
            snapshotID,
            ...map,
            pp: map.pp ?? null,
        })),
    } satisfies Prisma.FarmMapCreateManyArgs;
}
