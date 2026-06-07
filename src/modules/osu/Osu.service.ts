import { AbstractService } from "@/core/framework/AbstractService";
import { AdapterProvider, Beatmap, Beatmapset, GameMode, Score } from "@generated/adapter/types";
import { Import, Trace } from "@/core/decorators";
import { CalculatorService } from "./calculator/Calculator.service";
import { PopulatedUser } from "@domain/osu/Profile.dto";
import { plainToInstance } from "class-transformer";
import { PopulatedScore, ScoreWithMaps } from "@domain/osu/Score.dto";
import { ProviderMeta } from "@generated/adapter";
import { CalculatorMapService } from "./calculator/CalculatorMap.service";
import type { TRepository } from "@/core";

interface IUserWithScoresInput {
    nameOrID: string | number;
    mode: GameMode;
    type: "best" | "recent" | "firsts" | "pinned";
    limit: number;
    includeFails?: boolean;
    provider?: AdapterProvider;
}

export class OsuService extends AbstractService {
    @Import() declare private readonly calculatorService: CalculatorService;
    @Import() declare private readonly calculatorMapService: CalculatorMapService;

    /**
     * For how long we want to cache the osu! profile
     * in seconds.
     */
    private readonly profileCacheTtl: number = 300;

    //#region API

    @Trace("osu_user")
    public async user(
        nameOrID: string | number,
        mode: GameMode,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<PopulatedUser> {
        const client = this.adapter[provider];
        const isApiCacheable = ProviderMeta[provider].cache;

        if (isApiCacheable) {
            const inputCacheKey = `${nameOrID}:${mode}`;
            const cachedUser = await this.cache.get("osu_user_profile", inputCacheKey);

            if (cachedUser) {
                this.logger.debug(`Redis cache hit for user: ${nameOrID}`);
                const userInstance = plainToInstance(PopulatedUser, cachedUser);
                return userInstance;
            }
        }

        const userID = typeof nameOrID === "string" ? { username: nameOrID } : { id: nameOrID };
        const user = await client.user({ ...userID, mode });

        const populatedUser = { ...user, mode, provider } as PopulatedUser;

        if (isApiCacheable) {
            setImmediate(() => {
                this.updateUserCache(user.id, user.username, user.previousUsernames);

                const idCacheKey = `${user.id}:${mode}`;
                const usernameCacheKey = `${user.username.toLowerCase()}:${mode}`;

                // Cache by username and by ID.
                this.cache
                    .set("osu_user_profile", populatedUser, this.profileCacheTtl, idCacheKey)
                    .catch(console.error);
                this.cache
                    .set("osu_user_profile", populatedUser, this.profileCacheTtl, usernameCacheKey)
                    .catch(console.error);
            });
        }

        return populatedUser;
    }

    @Trace("osu_user_with_scores")
    public async userWithScores(data: IUserWithScoresInput): Promise<{ user: PopulatedUser; scores: Array<Score> }> {
        const provider = data.provider ?? AdapterProvider.Bancho;
        const isCacheable = ProviderMeta[provider].cache;

        const {
            nameOrID,
            mode,
            type,
            limit,
            includeFails
        } = data;

        if (typeof nameOrID === "number") {
            const [user, scores] = await Promise.all([
                this.user(nameOrID, mode, provider),
                this.fetchScoresByType(nameOrID, mode, type, limit, includeFails, provider),
            ]);
            return { user, scores };
        }

        const username = nameOrID.toLowerCase();
        let cachedID: number | null = null;

        if (isCacheable) {
            const cachedUser = await this.repository.userCache.findUnique({
                where: { username },
            });
            cachedID = cachedUser?.id || null;
        }

        if (cachedID) {
            const [user, initialScores] = await Promise.all([
                this.user(username, mode, provider),
                this.fetchScoresByType(cachedID, mode, type, limit, includeFails, provider).catch(() => null),
            ]);

            if (user.id !== cachedID || !initialScores) {
                this.logger.warn(`Namechange detected or cache stale for ${username}. Re-fetching scores...`);
                const correctedScores = await this.fetchScoresByType(user.id, mode, type, limit, includeFails, provider);
                return { user, scores: correctedScores };
            }

            return { user, scores: initialScores };
        }

        const user = await this.user(username, mode, provider);
        const scores = await this.fetchScoresByType(user.id, mode, type, limit, includeFails, provider);
        return { user, scores };
    }

    @Trace("osu_best")
    public async best(
        id: number,
        mode: GameMode,
        limit: number,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<Score>> {
        return await this.adapter[provider].best({ id, mode, limit });
    }

    @Trace("osu_recent")
    public async recent(
        id: number,
        mode: GameMode,
        limit: number,
        includeFails: boolean = false,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<Score>> {
        return await this.adapter[provider].recent({ id, mode, limit, includeFails });
    }

    @Trace("osu_beatmap")
    public async beatmap(
        id: number,
        provider: AdapterProvider = AdapterProvider.Bancho,
        bypassCache: boolean = false,
    ): Promise<Beatmap | null> {
        if (!bypassCache) {
            const cached = await this.repository.beatmap.findUnique({
                where: { id },
                include: { beatmapset: { include: { covers: true } }, owners: true },
            });

            if (cached) {
                return plainToInstance(Beatmap, cached);
            }
        }

        const apiData = await this.adapter[provider].beatmap({ id });
        if (!apiData) return null;

        await this.upsertBeatmap(apiData);

        return apiData;
    }

    @Trace("osu_beatmaps")
    public async beatmaps(
        ids: Array<number>,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<Beatmap>> {
        const cached = await this.repository.beatmap.findMany({
            where: { id: { in: ids } },
            include: {
                beatmapset: { include: { covers: true } },
                owners: true,
            },
        });

        const cachedIDs = new Set(cached.map((b) => b.id));
        const missingIDs = ids.filter((id) => !cachedIDs.has(id));

        const results: Array<Beatmap> = plainToInstance(Beatmap, cached);

        if (missingIDs.length > 0) {
            const CHUNK_SIZE = 50;

            for (let i = 0; i < missingIDs.length; i += CHUNK_SIZE) {
                const chunk = missingIDs.slice(i, i + CHUNK_SIZE);
                const apiData = await this.adapter[provider].beatmaps({ ids: chunk });

                if (apiData && Array.isArray(apiData)) {
                    await this.upsertBeatmaps(apiData);
                    results.push(...apiData);
                }
            }
        }

        return ids.map((id) => results.find((r) => r.id === id)).filter((b): b is Beatmap => !!b);
    }

    @Trace("osu_beatmapset")
    public async beatmapset(
        id: number,
        provider: AdapterProvider = AdapterProvider.Bancho,
        bypassCache: boolean = false,
    ): Promise<Beatmapset | null> {
        if (!bypassCache) {
            const cached = await this.repository.beatmapset.findUnique({
                where: { id },
                include: { covers: true, beatmaps: { include: { owners: true } } },
            });

            if (cached) {
                return plainToInstance(Beatmapset, cached);
            }
        }

        const apiData = await this.adapter[provider].beatmapset({ id });
        if (!apiData) return null;

        if (bypassCache && apiData.beatmaps) {
            const cachedMaps = await this.repository.beatmap.findMany({
                where: { beatmapsetID: id },
            });
            const cachedChecksums = new Map(cachedMaps.map((m) => [m.id, m.checksum]));

            for (const apiMap of apiData.beatmaps) {
                const cachedSum = cachedChecksums.get(apiMap.id);
                if (cachedSum && cachedSum !== apiMap.checksum) {
                    this.calculatorMapService.delete(apiMap.id);
                }
            }
        }

        await this.upsertBeatmapset(apiData);

        if (apiData.beatmaps && apiData.beatmaps.length > 0) {
            const beatmapsToUpsert = apiData.beatmaps.map((b) => {
                b.beatmapsetID = id;
                return b;
            });
            await this.upsertBeatmaps(beatmapsToUpsert);
        }

        return apiData;
    }

    @Trace("osu_populate_maps")
    public async populateMaps(
        scores: Array<Score>,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<ScoreWithMaps>> {
        const mapIds = [...new Set(scores.map((s) => s.beatmapID))];
        const fetchedMaps = mapIds.length > 0 ? await this.beatmaps(mapIds, provider) : [];

        const mapDict = new Map(fetchedMaps.map((m) => [m.id, m]));
        const populated: Array<ScoreWithMaps> = [];

        for (const score of scores) {
            const fetched = mapDict.get(score.beatmapID);

            if (fetched && fetched.beatmapset) {
                populated.push({
                    ...score,
                    beatmap: fetched,
                    beatmapset: fetched.beatmapset,
                });
            }
        }

        return plainToInstance(ScoreWithMaps, populated);
    }

    @Trace("osu_populate_calculations")
    public async populateCalculations<M extends GameMode>(
        scores: Array<ScoreWithMaps>,
        mode: M,
        includeFC: boolean = false,
    ): Promise<Array<PopulatedScore<M>>> {
        return await this.calculatorService.scores(scores, mode, includeFC);
    }

    @Trace("osu_populate_all")
    public async populateAll<M extends GameMode>(
        scores: Array<Score>,
        mode: M,
        includeFC: boolean = true,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<PopulatedScore<M>>> {
        const withMaps = await this.populateMaps(scores, provider);
        const populated = await this.populateCalculations(withMaps, mode, includeFC);
        return populated;
    }

    @Trace("osu_resolve_cached_id")
    public async resolveCachedID(nameOrID: string | number): Promise<number | null> {
        if (typeof nameOrID === "number") return nameOrID;

        const cachedUser = await this.repository.userCache.findUnique({
            where: { username: nameOrID.toLowerCase() },
        });

        return cachedUser?.id || null;
    }

    //#endregion

    //#region Internal

    @Trace("osu_upsert_beatmapset")
    private async upsertBeatmapset(data: Beatmapset, repository?: TRepository): Promise<void> {
        const { covers, ...rest } = data;

        const cb = async (repo: TRepository) => {
            await repo.beatmapset.upsert({
                where: { id: rest.id },
                create: {
                    ...rest,
                    beatmaps: undefined,
                    covers: covers ? { create: covers } : undefined,
                },
                update: {
                    ...rest,
                    beatmaps: undefined,
                    covers: covers
                        ? {
                              upsert: { create: covers, update: covers },
                          }
                        : undefined,
                },
            });
        };

        return repository ? cb(repository) : this.repository.$transaction(cb);
    }

    @Trace("osu_upsert_beatmaps")
    private async upsertBeatmaps(maps: Array<Beatmap>): Promise<void> {
        if (!maps.length) return;

        const uniqueSets = new Map<number, Beatmapset>();
        const uniqueOwners = new Map<number, { id: number; username: string }>();

        for (const map of maps) {
            if (map.beatmapset) uniqueSets.set(map.beatmapset.id, map.beatmapset);
            if (map.owners) {
                for (const owner of map.owners) {
                    uniqueOwners.set(owner.id, { id: owner.id, username: owner.username });
                }
            }
        }

        await this.repository.$transaction(async (tx) => {
            if (uniqueOwners.size > 0) {
                await Promise.all(
                    Array.from(uniqueOwners.values()).map((owner) =>
                        tx.beatmapOwner.upsert({
                            where: { id: owner.id },
                            create: owner,
                            update: { username: owner.username },
                        }),
                    ),
                );
            }

            if (uniqueSets.size > 0) {
                await Promise.all(Array.from(uniqueSets.values()).map((set) => this.upsertBeatmapset(set, tx)));
            }

            await Promise.all(
                maps.map((map) => {
                    const { owners, ...rest } = map;

                    const ownerConnect = owners?.map((o) => ({ id: o.id })) || [];

                    return tx.beatmap.upsert({
                        where: { id: rest.id },
                        create: {
                            ...rest,
                            beatmapset: undefined,
                            owners: ownerConnect.length > 0 ? { connect: ownerConnect } : undefined,
                        },
                        update: {
                            ...rest,
                            beatmapset: undefined,
                            owners: ownerConnect.length > 0 ? { set: ownerConnect } : undefined,
                        },
                    });
                }),
            );
        });
    }

    @Trace("osu_upsert_beatmap")
    private async upsertBeatmap(data: Beatmap, repository?: TRepository): Promise<void> {
        const { beatmapset, owners, ...rest } = data;

        const cb = async (repo: TRepository) => {
            if (beatmapset) await this.upsertBeatmapset(beatmapset, repo);

            const ownerRelations =
                owners && owners.length > 0
                    ? {
                          connectOrCreate: owners.map((o) => ({
                              where: { id: o.id },
                              create: { id: o.id, username: o.username },
                          })),
                      }
                    : undefined;

            await repo.beatmap.upsert({
                where: { id: rest.id },
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

    @Trace("osu_fetch_scores_by_type")
    private async fetchScoresByType(
        id: number,
        mode: GameMode,
        type: "best" | "recent" | "firsts" | "pinned",
        limit: number,
        includeFails: boolean = false,
        provider: AdapterProvider,
    ): Promise<Array<Score>> {
        switch (type) {
            case "recent":
                return await this.adapter[provider].recent({ id, mode, limit, includeFails });
            default:
                return await this.adapter[provider].best({ id, mode, limit });
        }
    }

    private updateUserCache(id: number, username: string, previous: Array<string> = []): void {
        const namesToCache = [username, ...previous].map((n) => n.toLowerCase());

        Promise.all(
            namesToCache.map((name) =>
                this.repository.userCache.upsert({
                    where: { username: name },
                    create: { id, username: name },
                    update: { id },
                }),
            ),
        ).catch((err) => this.logger.error(err, `Failed to update UserCache for ${username}`));
    }

    //#endregion
}
