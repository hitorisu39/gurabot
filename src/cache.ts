import Redis from "ioredis";
import { TConfig } from "./env";
import { TConstructor, TLogger, TMetrics } from "./core";
import { ICacheSchema } from "@domain/core/Cache";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { plainToInstance } from "class-transformer";
import { uuidv7 } from "uuidv7";

export class Cache {
    private redis: Redis | null;

    constructor(
        private readonly config: TConfig,
        private readonly logger: TLogger,
        private readonly metrics?: TMetrics,
    ) {
        const retryStrategy = config.app.mode === "production" ? undefined : () => null;

        this.redis = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            db: config.redis.database,
            lazyConnect: true,
            maxRetriesPerRequest: 3,
            retryStrategy,
        });

        this.redis.on("error", (err) => {
            this.logger.error(err, "Redis Connection Error");
        });
    }

    public async connect(): Promise<void> {
        if (!this.redis) {
            this.logger.warn("Cannot connect: Redis instance has been flushed.");
            return;
        }
        await this.redis.connect();
        this.logger.info("Redis cache connection established.");
    }

    public async disconnect(): Promise<void> {
        if (!this.redis) return;
        await this.redis.quit();
        this.redis = null;
        this.logger.info("Disconnected from Redis cache.");
    }

    /**
     * Internal helper to build keys like "prefix" or "prefix:12345"
     */
    private buildKey(baseKey: string, id?: string | number): string {
        return id !== undefined && id !== null ? `${baseKey}:${id}` : baseKey;
    }

    /**
     * Gets a typed value from Redis.
     */
    public async get<K extends keyof ICacheSchema>(baseKey: K, id?: string | number): Promise<ICacheSchema[K] | null> {
        if (!this.redis) throw new Exception(EApplicationError.INTERNAL_ERROR, "Redis is not connected.");

        const key = this.buildKey(baseKey as string, id);
        const data = await this.redis.get(key);

        if (this.metrics) {
            this.metrics.cacheOperations.inc({
                operation: "get",
                status: data ? "hit" : "miss",
            });
        }

        if (!data) return null;

        try {
            return JSON.parse(data) as ICacheSchema[K];
        } catch {
            return data as unknown as ICacheSchema[K];
        }
    }

    /**
     * Gets a typed value as instance from Redis.
     */
    public async getInstance<T>(
        baseKey: keyof ICacheSchema,
        type: TConstructor<T>,
        id?: string | number,
    ): Promise<T | null> {
        const value = await this.get(baseKey, id);

        if (value === null) {
            return null;
        }

        return plainToInstance(type, value);
    }

    /**
     * Sets a typed value in Redis.
     * @param ttlSeconds Optional Time-To-Live in seconds.
     */
    public async set<K extends keyof ICacheSchema>(
        baseKey: K,
        value: ICacheSchema[K],
        ttlSeconds?: number,
        id?: string | number,
    ): Promise<void> {
        if (!this.redis) throw new Exception(EApplicationError.INTERNAL_ERROR, "Redis is not connected.");

        const key = this.buildKey(baseKey as string, id);
        const payload = JSON.stringify(value);

        if (this.metrics) this.metrics.cacheOperations.inc({ operation: "set", status: "success" });

        if (ttlSeconds) {
            await this.redis.set(key, payload, "EX", ttlSeconds);
        } else {
            await this.redis.set(key, payload);
        }
    }

    /**
     * Deletes a key from Redis.
     */
    public async delete<K extends keyof ICacheSchema>(baseKey: K, id?: string | number): Promise<void> {
        if (!this.redis) throw new Exception(EApplicationError.INTERNAL_ERROR, "Redis is not connected.");

        if (this.metrics) this.metrics.cacheOperations.inc({ operation: "delete", status: "success" });

        const key = this.buildKey(baseKey as string, id);
        await this.redis.del(key);
    }

    /**
     * Gets a single value from a Redis Hash.
     */
    public async hGet<K extends keyof ICacheSchema>(baseKey: K, field: string): Promise<ICacheSchema[K] | null> {
        if (!this.redis) throw new Exception(EApplicationError.INTERNAL_ERROR, "Redis is not connected.");

        const data = await this.redis.hget(baseKey as string, field);

        if (this.metrics) {
            this.metrics.cacheOperations.inc({ operation: "hGet", status: data ? "hit" : "miss" });
        }

        if (!data) return null;

        try {
            return JSON.parse(data) as ICacheSchema[K];
        } catch {
            return data as ICacheSchema[K];
        }
    }

    /**
     * Sets a single value in a Redis Hash.
     */
    public async hSet<K extends keyof ICacheSchema>(baseKey: K, field: string, value: ICacheSchema[K]): Promise<void> {
        if (!this.redis) throw new Exception(EApplicationError.INTERNAL_ERROR, "Redis is not connected.");

        const payload = typeof value === "string" ? value : JSON.stringify(value);
        await this.redis.hset(baseKey as string, field, payload);

        if (this.metrics) this.metrics.cacheOperations.inc({ operation: "hSet", status: "success" });
    }

    /**
     * Deletes a single field from a Redis Hash.
     */
    public async hDel<K extends keyof ICacheSchema>(baseKey: K, field: string): Promise<void> {
        if (!this.redis) throw new Exception(EApplicationError.INTERNAL_ERROR, "Redis is not connected.");

        await this.redis.hdel(baseKey as string, field);
        if (this.metrics) this.metrics.cacheOperations.inc({ operation: "hDel", status: "success" });
    }

    /**
     * Sets multiple fields in a Redis Hash simultaneously (Bulk Load).
     */
    public async hSetMulti<K extends keyof ICacheSchema>(
        baseKey: K,
        data: Record<string, ICacheSchema[K]>,
    ): Promise<void> {
        if (!this.redis) throw new Exception(EApplicationError.INTERNAL_ERROR, "Redis is not connected.");
        if (Object.keys(data).length === 0) return;

        const payload: Record<string, string> = {};
        for (const [key, value] of Object.entries(data)) {
            payload[key] = typeof value === "string" ? value : JSON.stringify(value);
        }

        await this.redis.hset(baseKey as string, payload);
        if (this.metrics) this.metrics.cacheOperations.inc({ operation: "hSetMulti", status: "success" });
    }

    /**
     * Acquires a distributed lock.
     *
     * Returns an ownership token when successful, otherwise null.
     */
    public async acquireLock(key: string, ttlMs: number): Promise<string | null> {
        if (!this.redis) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "Redis is not connected.");
        }

        const token = uuidv7();
        const result = await this.redis.set(key, token, "PX", ttlMs, "NX");

        return result === "OK" ? token : null;
    }

    /**
     * Releases a distributed lock only if this caller still owns it.
     *
     * A dedicated Redis connection is used because WATCH state belongs
     * to the connection and Cache's primary connection is shared.
     */
    public async releaseLock(key: string, token: string): Promise<void> {
        if (!this.redis) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "Redis is not connected.");
        }

        const redis = this.redis.duplicate({
            lazyConnect: true,
        });

        try {
            await redis.connect();

            while (true) {
                await redis.watch(key);

                const current = await redis.get(key);

                if (current !== token) {
                    await redis.unwatch();
                    return;
                }

                const result = await redis.multi().del(key).exec();

                /**
                 * null means the watched key changed before EXEC.
                 */
                if (result !== null) {
                    return;
                }
            }
        } finally {
            redis.disconnect();
        }
    }

    /**
     * Reserves a temporary distributed lease.
     *
     * Unlike acquireLock(), this lease is intentionally not released:
     * callers use its expiry itself as the throttle.
     */
    public async reserveLease(key: string, ttlMs: number): Promise<boolean> {
        if (!this.redis) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "Redis is not connected.");
        }

        const result = await this.redis.set(key, uuidv7(), "PX", ttlMs, "NX");
        return result === "OK";
    }
}
