import { AbstractService } from "@/core/framework/AbstractService";
import { AdapterProvider, GameMode } from "@generated/adapter/types";
import { ProviderMeta } from "@generated/adapter";
import { PopulatedUser } from "@domain/osu/Profile.dto";
import { plainToInstance } from "class-transformer";
import { Trace } from "@/core/decorators";

export class OsuUserService extends AbstractService {
    /**
     * For how long we want to cache the osu! profile in seconds.
     */
    private readonly profileCacheTtl = 300;

    @Trace()
    public async user(
        nameOrID: string | number,
        mode: GameMode,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<PopulatedUser> {
        const client = this.adapter[provider];
        const isApiCacheable = ProviderMeta[provider].cache;
        const normalizedNameOrID = this.normalizeUserLookup(nameOrID);

        if (isApiCacheable) {
            const cacheKey = this.getProfileCacheKey(normalizedNameOrID, mode, provider);
            const cachedUser = await this.cache.get("osu_user_profile", cacheKey);

            if (cachedUser) {
                this.logger.debug(`Redis cache hit for user: ${normalizedNameOrID} (${provider})`);

                return plainToInstance(PopulatedUser, cachedUser);
            }
        }

        const userIdentifier =
            typeof normalizedNameOrID === "string" ? { username: normalizedNameOrID } : { id: normalizedNameOrID };

        const user = await client.user({
            ...userIdentifier,
            mode,
        });

        const populatedUser = {
            ...user,
            mode,
            provider,
        } as PopulatedUser;

        if (isApiCacheable) {
            setImmediate(() => {
                this.updateUserLookupCache(user.id, user.username, user.previousUsernames, provider);

                const idCacheKey = this.getProfileCacheKey(user.id, mode, provider);
                const usernameCacheKey = this.getProfileCacheKey(user.username.toLowerCase(), mode, provider);

                this.cache.set("osu_user_profile", populatedUser, this.profileCacheTtl, idCacheKey).catch((error) => {
                    this.logger.error(error, `Failed to cache profile ${user.id} (${provider}) by ID`);
                });

                this.cache
                    .set("osu_user_profile", populatedUser, this.profileCacheTtl, usernameCacheKey)
                    .catch((error) => {
                        this.logger.error(error, `Failed to cache profile ${user.id} (${provider}) by username`);
                    });
            });
        }

        return populatedUser;
    }

    @Trace()
    public async resolveCachedID(nameOrID: string | number, provider: AdapterProvider): Promise<number | null> {
        if (typeof nameOrID === "number") {
            return nameOrID;
        }
        const cachedUser = await this.repository.userCache.findUnique({
            where: {
                username_server: {
                    username: nameOrID.toLowerCase(),
                    server: provider,
                },
            },
        });

        return cachedUser?.id ?? null;
    }

    private getProfileCacheKey(nameOrID: string | number, mode: GameMode, provider: AdapterProvider): string {
        return `${provider}:${nameOrID}:${mode}`;
    }

    private updateUserLookupCache(
        id: number,
        username: string,
        previous: Array<string> = [],
        provider: AdapterProvider,
    ): void {
        const namesToCache = [username, ...previous].map((name) => name.toLowerCase());

        Promise.all(
            namesToCache.map((name) =>
                this.repository.userCache.upsert({
                    where: {
                        username_server: {
                            username: name,
                            server: provider,
                        },
                    },
                    create: {
                        id,
                        username: name,
                        server: provider,
                    },
                    update: {
                        id,
                    },
                }),
            ),
        ).catch((error) => {
            this.logger.error(error, `Failed to update UserCache for ${username} (${provider})`);
        });
    }

    private normalizeUserLookup(nameOrID: string | number): string | number {
        return typeof nameOrID === "string" ? nameOrID.toLowerCase() : nameOrID;
    }
}
