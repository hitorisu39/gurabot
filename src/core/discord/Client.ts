import {
    ApplicationCommandDataResolvable,
    Awaitable,
    ClientEvents,
    ClientOptions,
    Client as DiscordClient,
    GatewayIntentBits,
    Options,
    Partials,
    REST,
    Routes,
} from "discord.js";

import { EApplicationError, Exception } from "@domain/core/Exception";
import { TConfig } from "@/env";
import { ClusterClient, getInfo } from "discord-hybrid-sharding";
import { TDispatcher, TLogger, TMetrics } from "../types";
import { CommandRouter } from "./CommandRouter";
import { ComponentRouter } from "./ComponentRouter";

/**
 * Discord client lifecycle and connection.
 * Acts as a wrapper above Discord.js
 */
export class Client {
    /**
     * Underlying Discord.js client instance.
     */
    private readonly client: DiscordClient;

    /**
     * Underlying cluster client.
     */
    public readonly cluster: ClusterClient<DiscordClient> | null;
    private pingInterval: NodeJS.Timeout | null = null;

    /**
     * Routers for Discord interaction events.
     */
    public readonly commandRouter: CommandRouter;
    public readonly componentRouter: ComponentRouter;

    /**
     * Creates a new client instance
     *
     * @param config Application configuration
     * @param logger Application logger
     * @param dispatcher Application dispatcher
     * @param metrics Application metrics instance
     */
    constructor(
        private readonly config: TConfig,
        private readonly logger: TLogger,
        private readonly dispatcher: TDispatcher,
        private readonly metrics: TMetrics,
    ) {
        const options: ClientOptions = {
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages,
            ],
            partials: [Partials.Channel, Partials.Message],
            makeCache: Options.cacheWithLimits({
                ...Options.DefaultMakeCacheSettings,
                MessageManager: 20,
                PresenceManager: 0,
                ThreadManager: 10,
                VoiceStateManager: 0,
            }),
            sweepers: {
                ...Options.DefaultSweeperSettings,
                messages: {
                    interval: 3600,
                    lifetime: 1600,
                },
                users: {
                    interval: 3600,
                    filter: () => (user) => user.id !== this.client.user?.id,
                },
            },
        };

        if (config.app.is_cluster) {
            const shardInfo = getInfo();
            options.shards = shardInfo.SHARD_LIST;
            options.shardCount = shardInfo.TOTAL_SHARDS;
        }

        this.cluster = null;
        this.client = new DiscordClient(options);

        this.commandRouter = new CommandRouter(logger, dispatcher, metrics);
        this.componentRouter = new ComponentRouter(logger, dispatcher, metrics);

        if (config.app.is_cluster) this.cluster = new ClusterClient(this.client);
    }

    /**
     * Trigger ready for the cluster manager in case we're running as a cluster.
     */
    public clientReady(): void {
        if (this.cluster) this.cluster.triggerReady();
        this.startMetricsInterval();
    }

    private startMetricsInterval(): void {
        if (!this.metrics) return;

        this.pingInterval = setInterval(() => {
            const clusterId = this.cluster?.id.toString() || "0";
            this.metrics!.discordPing.set({ cluster_id: clusterId }, this.client.ws.ping);
            this.metrics!.guildCount.set({ cluster_id: clusterId }, this.client.guilds.cache.size);
        }, 15000);
    }

    /**
     * Destroy the Discord client instance.
     */
    public async destroy(): Promise<void> {
        if (this.pingInterval) clearInterval(this.pingInterval);
        await this.client.destroy();
    }

    /**
     * Listens for a specific Discord event.
     *
     * @param event The event name to listen to
     * @param listener The callback function to execute
     * @returns The client instance for chaining
     */
    public on<K extends keyof ClientEvents>(event: K, listener: (...args: ClientEvents[K]) => Awaitable<void>): this {
        this.client.on(event, listener);
        return this;
    }

    /**
     * Listens for a specific Discord event exactly once.
     *
     * @param event The event name to listen to
     * @param listener The callback function to execute
     * @returns The client instance for chaining
     */
    public once<K extends keyof ClientEvents>(event: K, listener: (...args: ClientEvents[K]) => Awaitable<void>): this {
        this.client.once(event, listener);
        return this;
    }

    /**
     * Logs the bot into Discord and initializes services.
     */
    public async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.client.once("clientReady", () => {
                this.clientReady();
                resolve();
            });

            this.client.login(this.config.discord.token).catch(reject);
        });
    }

    /**
     * Sends the command payload to Discord to register Slash Commands globally.
     */
    public async registerApplicationCommands(): Promise<void> {
        if (!this.client.user)
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "Cannot register application commands: Client is not logged in.",
            );

        const rest = new REST({ version: "10" }).setToken(this.config.discord.token);

        try {
            await rest.put(Routes.applicationCommands(this.client.user.id), {
                body: this.commandRouter.getApplicationCommandData(),
            });
        } catch (error) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `Failed to register application commands: ${error}`);
        }
    }

    /**
     * Fetch the total guild count across all shards.
     */
    public async getTotalGuildCount(): Promise<number> {
        if (!this.cluster) return this.client.guilds.cache.size;

        const results: Array<number> = await this.cluster.broadcastEval((c) => c.guilds.cache.size);
        return results.reduce((acc, guildCount) => acc + guildCount, 0);
    }

    /**
     * Check if we're running in the main cluster.
     */
    public isMainCluster(): boolean {
        return !this.cluster || this.cluster.id === 0;
    }
}
