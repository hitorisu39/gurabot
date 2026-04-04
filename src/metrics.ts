import client, { AggregatorRegistry } from "prom-client";
import http from "node:http";
import { TLogger } from "./core";
import { Client } from "./core/discord/Client";
import { TConfig } from "./env";

export class Metrics {
    public readonly commandHistogram: client.Histogram<"command" | "status">;
    public readonly componentHistogram: client.Histogram<"component" | "status">;
    public readonly httpRequestHistogram: client.Histogram<"endpoint" | "status">;

    public readonly cacheOperations: client.Counter<"operation" | "status">;
    public readonly discordPing: client.Gauge<"cluster_id">;
    public readonly guildCount: client.Gauge<"cluster_id">;

    public readonly databaseQueryHistogram: client.Histogram<"model" | "operation" | "status">;
    public readonly databasePoolStats: client.Gauge<"state">;

    constructor(
        private readonly config: TConfig,
        private readonly logger: TLogger,
    ) {
        client.collectDefaultMetrics({ prefix: `${config.app.name}_` });

        this.commandHistogram = new client.Histogram({
            name: `${config.app.name}_command_duration_seconds`,
            help: "Duration of bot commands in seconds",
            labelNames: ["command", "status", "type"],
            buckets: [0.1, 0.5, 1, 2, 5, 10],
        });

        this.componentHistogram = new client.Histogram({
            name: `${config.app.name}_component_duration_seconds`,
            help: "Duration of bot components in seconds",
            labelNames: ["component", "status"],
            buckets: [0.1, 0.5, 1, 2, 5],
        });

        this.httpRequestHistogram = new client.Histogram({
            name: `${config.app.name}_http_request_duration_seconds`,
            help: "Duration of outgoing HTTP requests",
            labelNames: ["endpoint", "status"],
            buckets: [0.05, 0.1, 0.5, 1, 2, 5],
        });

        this.cacheOperations = new client.Counter({
            name: `${config.app.name}_cache_operations_total`,
            help: "Total number of cache operations",
            labelNames: ["operation", "status"],
        });

        this.discordPing = new client.Gauge({
            name: `${config.app.name}_discord_websocket_ping_milliseconds`,
            help: "Discord Gateway websocket ping latency in ms",
            labelNames: ["cluster_id"],
        });

        this.guildCount = new client.Gauge({
            name: `${config.app.name}_guilds_total`,
            help: "Total number of guilds the bot is in",
            labelNames: ["cluster_id"],
        });

        this.databaseQueryHistogram = new client.Histogram({
            name: `${config.app.name}_database_query_duration_seconds`,
            help: "Duration of database queries in seconds",
            labelNames: ["model", "operation", "status"],
            buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
        });

        this.databasePoolStats = new client.Gauge({
            name: `${config.app.name}_database_pool_connections`,
            help: "PostgreSQL connection pool statistics",
            labelNames: ["state"], // "active", "idle", "waiting"
        });
    }

    public startServer(discordClient: Client, port: number = 9090): void {
        http.createServer(async (req, res) => {
            if (req.url === "/metrics") {
                try {
                    let metricsString: string;

                    if (discordClient.cluster) {
                        const clusterMetrics = await discordClient.cluster.broadcastEval(async () => {
                            const { register } = await import("prom-client");
                            return register.getMetricsAsJSON();
                        });

                        const combinedRegistry = AggregatorRegistry.aggregate(clusterMetrics as any[]);
                        metricsString = await combinedRegistry.metrics();
                        res.setHeader("Content-Type", combinedRegistry.contentType);
                    } else {
                        metricsString = await client.register.metrics();
                        res.setHeader("Content-Type", client.register.contentType);
                    }

                    res.writeHead(200);
                    res.end(metricsString);
                } catch (error) {
                    this.logger.error(error, "Failed to aggregate Prometheus metrics");
                    res.writeHead(500);
                    res.end("Internal Server Error");
                }
            } else {
                res.writeHead(404);
                res.end();
            }
        }).listen(port, () => {
            this.logger.info(`Prometheus server listening on port ${port}`);
        });
    }
}
