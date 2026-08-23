import { AbstractService } from "@/core/framework/AbstractService";
import { AdapterProvider, Beatmap, BeatmapPlaycount, BeatmapSearchResult, Beatmapset } from "@generated/adapter/types";
import { Import, Trace } from "@/core/decorators";
import { CalculatorMapService } from "./calculator/CalculatorMap.service";
import type { TRepository } from "@/core";
import { plainToInstance } from "class-transformer";
import type { IBeatmapsetSearchInput } from "@domain/osu/Adapter.dto";

export class OsuBeatmapService extends AbstractService {
    @Import()
    declare private readonly calculatorMapService: CalculatorMapService;

    /**
     * Maximum number of beatmaps requested from osu! in a single API request.
     */
    private readonly beatmapFetchChunkSize = 50;

    /**
     * Maximum number of beatmap API requests executed concurrently.
     */
    private readonly beatmapFetchConcurrency = 2;

    /**
     * Maximum number of beatmaps persisted in one cache transaction.
     */
    private readonly beatmapCacheWriteBatchSize = 100;

    /**
     * Beatmaps waiting to be persisted to PostgreSQL.
     */
    private readonly pendingBeatmapCacheWrites = new Map<number, Beatmap>();

    /**
     * Short-lived process-local cache while PostgreSQL writes are pending.
     */
    private readonly transientBeatmapCache = new Map<number, Beatmap>();

    private beatmapCacheFlushScheduled = false;
    private beatmapCacheFlushRunning = false;

    @Trace()
    public async beatmap(
        id: number,
        provider: AdapterProvider = AdapterProvider.Bancho,
        bypassCache = false,
    ): Promise<Beatmap | null> {
        // Force Bancho for beatmap retrieval.
        provider = AdapterProvider.Bancho;

        if (!bypassCache) {
            const cached = await this.repository.beatmap.findUnique({
                where: {
                    id,
                },
                include: {
                    beatmapset: {
                        include: {
                            covers: true,
                        },
                    },
                    owners: true,
                },
            });

            if (cached) {
                return plainToInstance(Beatmap, cached);
            }
        }

        const apiData = await this.adapter[provider].beatmap({ id });

        if (!apiData) {
            return null;
        }

        await this.upsertBeatmap(apiData);

        return apiData;
    }

    @Trace()
    public async beatmaps(
        ids: Array<number>,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<Beatmap>> {
        // Force Bancho for beatmap retrieval.
        provider = AdapterProvider.Bancho;

        if (ids.length === 0) {
            return [];
        }

        const uniqueIDs = [...new Set(ids)];

        const cached = await this.repository.beatmap.findMany({
            where: {
                id: {
                    in: uniqueIDs,
                },
            },
            include: {
                beatmapset: {
                    include: {
                        covers: true,
                    },
                },
                owners: true,
            },
        });

        const cachedMaps = plainToInstance(Beatmap, cached);
        const mapsByID = new Map<number, Beatmap>();

        for (const map of cachedMaps) {
            mapsByID.set(map.id, map);
        }

        for (const id of uniqueIDs) {
            if (mapsByID.has(id)) {
                continue;
            }

            const transient = this.transientBeatmapCache.get(id);

            if (transient) {
                mapsByID.set(id, transient);
            }
        }

        const missingIDs = uniqueIDs.filter((id) => !mapsByID.has(id));

        if (missingIDs.length > 0) {
            const fetchedMaps = await this.fetchMissingBeatmaps(missingIDs, provider);

            for (const map of fetchedMaps) {
                mapsByID.set(map.id, map);
                this.transientBeatmapCache.set(map.id, map);
            }

            this.queueBeatmapCacheWrite(fetchedMaps);
        }

        return ids.map((id) => mapsByID.get(id)).filter((map): map is Beatmap => map !== undefined);
    }

    @Trace()
    public async beatmapset(
        id: number,
        provider: AdapterProvider = AdapterProvider.Bancho,
        bypassCache = false,
    ): Promise<Beatmapset | null> {
        // Force Bancho for beatmap retrieval.
        provider = AdapterProvider.Bancho;

        if (!bypassCache) {
            const cached = await this.repository.beatmapset.findUnique({
                where: {
                    id,
                },
                include: {
                    covers: true,
                    beatmaps: {
                        include: {
                            owners: true,
                        },
                    },
                },
            });

            if (cached) {
                return plainToInstance(Beatmapset, cached);
            }
        }

        const apiData = await this.adapter[provider].beatmapset({ id });

        if (!apiData) {
            return null;
        }

        if (bypassCache && apiData.beatmaps) {
            const cachedMaps = await this.repository.beatmap.findMany({
                where: {
                    beatmapsetID: id,
                },
            });

            const cachedChecksums = new Map(cachedMaps.map((map) => [map.id, map.checksum]));

            for (const apiMap of apiData.beatmaps) {
                const cachedChecksum = cachedChecksums.get(apiMap.id);

                if (cachedChecksum && cachedChecksum !== apiMap.checksum) {
                    this.calculatorMapService.delete(apiMap.id);
                }
            }
        }

        await this.upsertBeatmapset(apiData);

        if (apiData.beatmaps?.length) {
            const beatmapsToUpsert = apiData.beatmaps.map((beatmap) => {
                beatmap.beatmapsetID = id;
                return beatmap;
            });

            await this.upsertBeatmaps(beatmapsToUpsert);
        }

        return apiData;
    }

    @Trace()
    public async search(
        input: IBeatmapsetSearchInput = {},
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<BeatmapSearchResult> {
        return this.adapter[provider].beatmapset_search({
            query: input.query,
            mode: input.mode,
            status: input.status,
            genre: input.genre,
            language: input.language,
            extras: input.extras,
            general: input.general,
            nsfw: input.nsfw,
            played: input.played,
            ranks: input.ranks,
            sortField: input.sort?.field,
            sortOrder: input.sort?.order,
            cursorString: input.cursorString,
            page: input.page,
        });
    }

    @Trace()
    public async mostPlayed(
        id: number,
        options?: {
            limit?: number;
            offset?: number;
        },
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<BeatmapPlaycount>> {
        return this.adapter[provider].most_played({
            id,
            limit: options?.limit,
            offset: options?.offset,
        });
    }

    private async fetchMissingBeatmaps(ids: Array<number>, provider: AdapterProvider): Promise<Array<Beatmap>> {
        if (ids.length === 0) {
            return [];
        }

        const chunks: Array<Array<number>> = [];

        for (let i = 0; i < ids.length; i += this.beatmapFetchChunkSize) {
            chunks.push(ids.slice(i, i + this.beatmapFetchChunkSize));
        }

        const results: Array<Array<Beatmap>> = new Array(chunks.length);
        let nextChunkIndex = 0;

        const worker = async (): Promise<void> => {
            while (true) {
                const index = nextChunkIndex++;

                if (index >= chunks.length) {
                    return;
                }

                const apiData = await this.adapter[provider].beatmaps({
                    ids: chunks[index]!,
                });

                results[index] = Array.isArray(apiData) ? apiData : [];
            }
        };

        const workerCount = Math.min(this.beatmapFetchConcurrency, chunks.length);

        await Promise.all(
            Array.from(
                {
                    length: workerCount,
                },
                () => worker(),
            ),
        );

        return results.flat();
    }

    private queueBeatmapCacheWrite(maps: ReadonlyArray<Beatmap>): void {
        if (maps.length === 0) {
            return;
        }

        for (const map of maps) {
            this.pendingBeatmapCacheWrites.set(map.id, map);
            this.transientBeatmapCache.set(map.id, map);
        }

        this.scheduleBeatmapCacheFlush();
    }

    private scheduleBeatmapCacheFlush(): void {
        if (this.pendingBeatmapCacheWrites.size === 0) {
            return;
        }

        if (this.beatmapCacheFlushRunning || this.beatmapCacheFlushScheduled) {
            return;
        }

        this.beatmapCacheFlushScheduled = true;

        setImmediate(() => {
            this.beatmapCacheFlushScheduled = false;
            void this.flushBeatmapCacheWrites();
        });
    }

    private async flushBeatmapCacheWrites(): Promise<void> {
        if (this.beatmapCacheFlushRunning) {
            return;
        }

        this.beatmapCacheFlushRunning = true;

        try {
            while (this.pendingBeatmapCacheWrites.size > 0) {
                const batch = Array.from(this.pendingBeatmapCacheWrites.values()).slice(
                    0,
                    this.beatmapCacheWriteBatchSize,
                );

                for (const map of batch) {
                    this.pendingBeatmapCacheWrites.delete(map.id);
                }

                try {
                    await this.upsertBeatmaps(batch);

                    for (const map of batch) {
                        if (this.transientBeatmapCache.get(map.id) === map) {
                            this.transientBeatmapCache.delete(map.id);
                        }
                    }
                } catch (error) {
                    this.logger.error(error, `Failed to cache ${batch.length} beatmaps`);

                    for (const map of batch) {
                        if (this.transientBeatmapCache.get(map.id) === map) {
                            this.transientBeatmapCache.delete(map.id);
                        }
                    }
                }
            }
        } finally {
            this.beatmapCacheFlushRunning = false;

            if (this.pendingBeatmapCacheWrites.size > 0) {
                this.scheduleBeatmapCacheFlush();
            }
        }
    }

    @Trace()
    private async upsertBeatmapset(data: Beatmapset, repository?: TRepository): Promise<void> {
        const { covers, ...rest } = data;

        const cb = async (repo: TRepository) => {
            await repo.beatmapset.upsert({
                where: {
                    id: rest.id,
                },
                create: {
                    ...rest,
                    beatmaps: undefined,
                    covers: covers
                        ? {
                              create: covers,
                          }
                        : undefined,
                },
                update: {
                    ...rest,
                    beatmaps: undefined,
                    covers: covers
                        ? {
                              upsert: {
                                  create: covers,
                                  update: covers,
                              },
                          }
                        : undefined,
                },
            });
        };

        return repository ? cb(repository) : this.repository.$transaction(cb);
    }

    @Trace()
    private async upsertBeatmaps(maps: Array<Beatmap>): Promise<void> {
        if (maps.length === 0) {
            return;
        }

        const uniqueSets = new Map<number, Beatmapset>();

        const uniqueOwners = new Map<
            number,
            {
                id: number;
                username: string;
            }
        >();

        for (const map of maps) {
            if (map.beatmapset) {
                uniqueSets.set(map.beatmapset.id, map.beatmapset);
            }

            if (map.owners) {
                for (const owner of map.owners) {
                    uniqueOwners.set(owner.id, {
                        id: owner.id,
                        username: owner.username,
                    });
                }
            }
        }

        await this.repository.$transaction(async (tx) => {
            for (const owner of uniqueOwners.values()) {
                await tx.beatmapOwner.upsert({
                    where: {
                        id: owner.id,
                    },
                    create: owner,
                    update: {
                        username: owner.username,
                    },
                });
            }

            for (const set of uniqueSets.values()) {
                await this.upsertBeatmapset(set, tx);
            }

            for (const map of maps) {
                const { owners, ...rest } = map;

                const ownerConnect =
                    owners?.map((owner) => ({
                        id: owner.id,
                    })) ?? [];

                await tx.beatmap.upsert({
                    where: {
                        id: rest.id,
                    },
                    create: {
                        ...rest,
                        beatmapset: undefined,
                        owners:
                            ownerConnect.length > 0
                                ? {
                                      connect: ownerConnect,
                                  }
                                : undefined,
                    },
                    update: {
                        ...rest,
                        beatmapset: undefined,
                        owners:
                            ownerConnect.length > 0
                                ? {
                                      set: ownerConnect,
                                  }
                                : undefined,
                    },
                });
            }
        });
    }

    @Trace()
    private async upsertBeatmap(data: Beatmap, repository?: TRepository): Promise<void> {
        const { beatmapset, owners, ...rest } = data;

        const cb = async (repo: TRepository) => {
            if (beatmapset) {
                await this.upsertBeatmapset(beatmapset, repo);
            }

            const ownerRelations = owners?.length
                ? {
                      connectOrCreate: owners.map((owner) => ({
                          where: {
                              id: owner.id,
                          },
                          create: {
                              id: owner.id,
                              username: owner.username,
                          },
                      })),
                  }
                : undefined;

            await repo.beatmap.upsert({
                where: {
                    id: rest.id,
                },
                create: {
                    ...rest,
                    owners: ownerRelations,
                },
                update: {
                    ...rest,
                    owners: ownerRelations,
                },
            });
        };

        return repository ? cb(repository) : this.repository.$transaction(cb);
    }
}
