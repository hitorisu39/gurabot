import { Client } from "@/core/discord/Client";

import { Core, IApplicationContext } from "./core";
import { Dispatcher } from "./core/dispatcher";
import { Database } from "./database";
import { TConfig } from "./env";
import { Logger } from "./logger";
import { Cache } from "./cache";
import { ExtendedAdapterClient } from "./adapter";
import { Calculator } from "./calculator";
import { Metrics } from "./metrics";
import { Session } from "./session";

export class Application {
    private readonly config: TConfig;
    private readonly applicationContext: IApplicationContext;
    private readonly core: Core;

    private readonly discord: Client;
    private readonly logger: Logger;
    private readonly database: Database;
    private readonly dispatcher: Dispatcher;
    private readonly cache: Cache;
    private readonly session: Session;
    private readonly adapter: ExtendedAdapterClient;
    private readonly calculator: Calculator;
    private readonly metrics: Metrics;

    constructor(config: TConfig) {
        this.config = config;

        this.logger = new Logger(this.config);
        this.metrics = new Metrics(this.config, this.logger);

        this.dispatcher = new Dispatcher(this.logger);
        this.discord = new Client(this.config, this.logger, this.dispatcher, this.metrics);
        this.database = new Database(this.config, this.logger, this.metrics);
        this.cache = new Cache(this.config, this.logger, this.metrics);
        this.session = new Session(this.cache, this.logger);
        this.calculator = new Calculator(this.config, this.logger);
        this.adapter = new ExtendedAdapterClient(this.config, this.logger, this.metrics);

        this.applicationContext = {
            config: this.config,
            logger: this.logger,
            discord: this.discord,
            dispatcher: this.dispatcher,
            cache: this.cache,
            session: this.session,
            calculator: this.calculator,
            metrics: this.metrics,
            repository: this.database.get(),
            adapter: this.adapter.flush(),
        };

        this.core = new Core(this.applicationContext);
        this.setupProcessEvents();
    }

    public async run(): Promise<void> {
        await this.cache.connect();
        await this.database.connect();
        await this.discord.start();
        await this.core.start();

        if (this.discord.isMainCluster()) {
            await this.discord.registerApplicationCommands();
            await this.metrics.startServer(this.discord, this.config.prom.port);
        }

        await this.dispatcher.dispatchAsync("app", "ready");

        this.logger.info(`The application has started up in ${this.config.app.mode} mode.`);
    }

    public async destroy(): Promise<void> {
        await this.discord.destroy();
        await this.database.disconnect();
        await this.cache.disconnect();
        this.calculator.destroy();
    }

    private setupProcessEvents(): void {
        process.on("unhandledRejection", (reason) => {
            this.logger.error(reason, "Unhandled Promise Rejection");
        });

        process.on("uncaughtException", (error: Error) => {
            this.logger.error(error, "Uncaught Exception");
        });

        const shutdown = async (signal: string) => {
            this.logger.info(`Received ${signal}, shutting down...`);
            await this.destroy();
            process.exit(0);
        };

        process.on("SIGINT", () => shutdown("SIGINT"));
        process.on("SIGTERM", () => shutdown("SIGTERM"));
    }
}
