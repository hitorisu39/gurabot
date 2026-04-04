import Redis from "ioredis";
import { TConfig } from "./env";
import { TLogger, TMetrics } from "./core";
import { ICacheSchema } from "@domain/core/Cache";
import { EApplicationError, Exception } from "@domain/core/Exception";

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
}
