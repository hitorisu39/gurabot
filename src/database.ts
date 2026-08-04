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
    private readonly prisma: PrismaClient;
    private readonly pool: Pool;

    private readonly gracefulSwitchGenerations = 2;
    private readonly idleTimeoutMs = 30_000;
    private readonly connectionTimeoutMs = 5_000;
    private readonly statementTimeoutMs = 15_000;
    private readonly lockTimeoutMs = 3_000;

    private poolInterval: NodeJS.Timeout | null = null;
    private disconnectPromise: Promise<void> | null = null;
    private connected = false;

    constructor(
        private readonly config: TConfig,
        private readonly logger: TLogger,
        private readonly metrics: TMetrics,
    ) {
        const dbUrl = this.createDatabaseUrl();

        const totalClusters = this.getTotalClusters();
        const concurrentGenerations = this.getConcurrentGenerations();
        const poolSizePerCluster = this.calculatePoolSize(totalClusters, concurrentGenerations);

        this.pool = new Pool({
            connectionString: dbUrl.toString(),

            // Maximum connections owned by this cluster process.
            max: poolSizePerCluster,

            // Remove unused connections after 30 seconds.
            idleTimeoutMillis: this.idleTimeoutMs,

            // Maximum time spent waiting to establish a new connection.
            connectionTimeoutMillis: this.connectionTimeoutMs,

            // Maximum execution time for an individual SQL statement.
            statement_timeout: this.statementTimeoutMs,

            // Maximum time a statement may wait for a PostgreSQL lock.
            lock_timeout: this.lockTimeoutMs,
        });

        this.pool.on("error", (error) => {
            this.logger.error(error, "Unexpected error from an idle PostgreSQL pool client");
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

        this.logger.debug(
            [
                "Initialized database pool.",
                `Connection budget: ${this.config.database.connection_limit}.`,
                `Total clusters: ${totalClusters}.`,
                `Concurrent generations: ${concurrentGenerations}.`,
                `Maximum connections for this cluster: ${poolSizePerCluster}.`,
            ].join(" "),
        );
    }

    public async connect(): Promise<void> {
        if (this.disconnectPromise) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "Cannot connect after the database has started disconnecting.",
            );
        }

        if (this.connected) {
            return;
        }

        await this.prisma.$connect();

        this.connected = true;
        this.startPoolMonitoring();

        this.logger.info("Database connection established.");
    }

    public disconnect(): Promise<void> {
        if (!this.disconnectPromise) {
            this.disconnectPromise = this.performDisconnect();
        }

        return this.disconnectPromise;
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

        this.poolInterval.unref();
    }

    private createDatabaseUrl(): URL {
        const { host, port, name, user, password } = this.config.database;

        const dbUrl = new URL(`postgresql://${host}:${port}/${encodeURIComponent(name)}`);

        dbUrl.username = user;
        dbUrl.password = password;

        return dbUrl;
    }

    private getTotalClusters(): number {
        const totalClusters = this.config.app.is_cluster ? this.config.discord.cluster.total : 1;
        return totalClusters;
    }

    private getConcurrentGenerations(): number {
        return this.config.app.is_cluster ? this.gracefulSwitchGenerations : 1;
    }

    private calculatePoolSize(totalClusters: number, concurrentGenerations: number): number {
        const connectionBudget = this.config.database.connection_limit;
        const maximumConcurrentPools = totalClusters * concurrentGenerations;
        const poolSizePerCluster = Math.floor(connectionBudget / maximumConcurrentPools);

        if (poolSizePerCluster < 1) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                [
                    `Database connection budget ${connectionBudget} is too small.`,
                    `The application may run ${maximumConcurrentPools} pools`,
                    `(${totalClusters} clusters × ${concurrentGenerations} generations).`,
                    `The minimum required connection limit is ${maximumConcurrentPools}.`,
                ].join(" "),
            );
        }

        return poolSizePerCluster;
    }

    private async performDisconnect(): Promise<void> {
        if (this.poolInterval) {
            clearInterval(this.poolInterval);
            this.poolInterval = null;
        }

        await this.prisma.$disconnect();

        this.connected = false;
        this.logger.info("Disconnected from the database.");
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
