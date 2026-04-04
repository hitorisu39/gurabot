import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "@generated/prisma/client";
import { TLogger, TMetrics } from "./core";
import { TConfig } from "./env";
import { EApplicationError, Exception } from "@domain/core/Exception";

/**
 * A small wrapper over Prisma, generally to just build
 * a connection string and flush the instance.
 */
export class Database {
    private prisma: PrismaClient | null;
    private pool: Pool | null = null;
    private poolInterval: NodeJS.Timeout | null = null;

    constructor(
        private readonly config: TConfig,
        private readonly logger: TLogger,
        private readonly metrics: TMetrics,
    ) {
        const dbUrl = new URL(`postgresql://${config.database.host}:${config.database.port}/${config.database.name}`);
        dbUrl.username = config.database.user;
        dbUrl.password = config.database.password;

        const totalClusters = config.app.is_cluster ? config.discord.cluster.total : 1;
        const poolSizePerShard = Math.max(1, Math.floor(config.database.connection_limit / totalClusters));

        this.pool = new Pool({
            connectionString: dbUrl.toString(),
            max: poolSizePerShard,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        const adapter = new PrismaPg(this.pool);
        const basePrisma = new PrismaClient({ adapter });

        this.prisma = basePrisma.$extends({
            query: {
                async $allOperations({ model, operation, args, query }) {
                    const start = performance.now();
                    let status = "success";
                    try {
                        return await query(args);
                    } catch (error) {
                        status = "error";
                        throw error;
                    } finally {
                        const durationSeconds = (performance.now() - start) / 1000;
                        metrics.databaseQueryHistogram.observe(
                            {
                                model: model || "Raw",
                                operation,
                                status,
                            },
                            durationSeconds,
                        );
                    }
                },
            },
        }) as PrismaClient;

        this.logger.debug(`Initialized DB Pool with max ${poolSizePerShard} connections per shard.`);
    }

    public async connect(): Promise<void> {
        if (!this.prisma) {
            this.logger.warn("Cannot connect: Prisma instance has been flushed.");
            return;
        }
        await this.prisma.$connect();
        this.startPoolMonitoring();
        this.logger.info("Database connection established.");
    }

    public async disconnect(): Promise<void> {
        if (this.poolInterval) clearInterval(this.poolInterval);

        if (!this.prisma) return;

        await this.prisma.$disconnect();
        this.logger.info("Disconnected from the database.");
    }

    private startPoolMonitoring(): void {
        if (!this.pool) return;

        this.poolInterval = setInterval(() => {
            const total = this.pool!.totalCount;
            const idle = this.pool!.idleCount;
            const waiting = this.pool!.waitingCount;

            this.metrics.databasePoolStats.set({ state: "active" }, total - idle);
            this.metrics.databasePoolStats.set({ state: "idle" }, idle);
            this.metrics.databasePoolStats.set({ state: "waiting" }, waiting);
        }, 15000);
    }

    /**
     * Extracts the Prisma instance.
     */
    public get(): PrismaClient {
        if (!this.prisma) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "Database instance has already been flushed.");
        }

        return this.prisma;
    }
}
