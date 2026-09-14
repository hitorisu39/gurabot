import client, { AggregatorRegistry } from "prom-client";
import http from "http";
import v8 from "v8";
import { TLogger } from "./core";
import { Client } from "./core/discord/Client";
import { TConfig } from "./env";

export type TExternalRequestOutcome =
    | "success"
    | "rate_limited"
    | "client_error"
    | "server_error"
    | "timeout"
    | "network_error"
    | "cancelled"
    | "unknown_error";

export class Metrics {
    public readonly commandHistogram: client.Histogram<"command" | "status">;
    public readonly componentHistogram: client.Histogram<"component" | "status">;

    public readonly cacheOperations: client.Counter<"operation" | "status">;
    public readonly discordPing: client.Gauge<"cluster_id">;
    public readonly guildCount: client.Gauge<"cluster_id">;

    public readonly databaseQueryHistogram: client.Histogram<"model" | "operation" | "status">;
    public readonly databasePoolStats: client.Gauge<"state">;

    public readonly discordGatewayPing: client.Gauge<"cluster_id">;
    public readonly discordGuilds: client.Gauge<"cluster_id">;
    public readonly discordShards: client.Gauge<"cluster_id">;

    public readonly nodeHeapLimit: client.Gauge<"cluster_id">;

    /**
     * Discord Gateway events
     */
    public readonly discordGatewayEvents: client.Counter<"cluster_id" | "event">;

    /**
     * Adapter requests
     */
    public readonly adapterApiRequests: client.Counter<"provider" | "endpoint" | "outcome" | "status_code">;
    public readonly adapterApiRequestDuration: client.Histogram<"provider" | "endpoint">;

    /**
     * External HTTP requests
     */
    public readonly externalRequests: client.Counter<"service" | "endpoint" | "outcome" | "status_code">;
    public readonly externalRequestDuration: client.Histogram<"service" | "endpoint">;
    public readonly externalRequestsInFlight: client.Gauge<"service" | "endpoint">;

    constructor(
        private readonly config: TConfig,
        private readonly logger: TLogger,
    ) {
        const clusterID = config.discord.cluster.id;

        client.collectDefaultMetrics({
            prefix: `${config.app.name}_`,
            labels: {
                cluster_id: clusterID,
            },
            eventLoopMonitoringPrecision: 10,
        });

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

        this.discordGatewayPing = new client.Gauge({
            name: `${config.app.name}_discord_gateway_ping_seconds`,
            help: "Discord Gateway WebSocket heartbeat latency in seconds",
            labelNames: ["cluster_id"] as const,
        });

        this.discordGuilds = new client.Gauge({
            name: `${config.app.name}_discord_guilds`,
            help: "Current number of Discord guilds handled by the cluster",
            labelNames: ["cluster_id"] as const,
        });

        this.discordShards = new client.Gauge({
            name: `${config.app.name}_discord_shards`,
            help: "Current number of Discord shards handled by the cluster",
            labelNames: ["cluster_id"] as const,
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

        this.nodeHeapLimit = new client.Gauge({
            name: `${config.app.name}_nodejs_heap_size_limit_bytes`,
            help: "Maximum V8 heap size available to the process in bytes",
            labelNames: ["cluster_id"],
        });

        /**
         * Discord Gateway events
         */
        this.discordGatewayEvents = new client.Counter({
            name: `${config.app.name}_discord_gateway_events_total`,
            help: "Total Discord Gateway dispatch events received",
            labelNames: ["cluster_id", "event"] as const,
        });

        /**
         * Adapter API requests
         */
        this.adapterApiRequests = new client.Counter({
            name: `${config.app.name}_adapter_api_requests_total`,
            help: "Total number of requests made through the osu! API adapter",
            labelNames: ["provider", "endpoint", "outcome", "status_code"],
        });

        this.adapterApiRequestDuration = new client.Histogram({
            name: `${config.app.name}_adapter_api_request_duration_seconds`,
            help: "Duration of requests made through the osu! API adapter",
            labelNames: ["provider", "endpoint"],
            buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 15],
        });

        /**
         * External HTTP requests
         */
        this.externalRequests = new client.Counter({
            name: `${config.app.name}_external_requests_total`,
            help: "Total number of requests to external HTTP services",
            labelNames: ["service", "endpoint", "outcome", "status_code"],
        });

        this.externalRequestDuration = new client.Histogram({
            name: `${config.app.name}_external_request_duration_seconds`,
            help: "Duration of requests to external HTTP services in seconds",
            labelNames: ["service", "endpoint"],
            buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 15],
        });

        this.externalRequestsInFlight = new client.Gauge({
            name: `${config.app.name}_external_requests_in_flight`,
            help: "Current number of requests in flight to external HTTP services",
            labelNames: ["service", "endpoint"],
            aggregator: "sum",
        });

        this.nodeHeapLimit.set({ cluster_id: config.discord.cluster.id }, v8.getHeapStatistics().heap_size_limit);
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

    public classifyHttpStatus(status: number): TExternalRequestOutcome {
        if (status >= 200 && status < 400) {
            return "success";
        }

        if (status === 429) {
            return "rate_limited";
        }

        if (status >= 400 && status < 500) {
            return "client_error";
        }

        if (status >= 500) {
            return "server_error";
        }

        return "unknown_error";
    }
}
