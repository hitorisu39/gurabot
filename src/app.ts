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
    public readonly config: TConfig;
    public readonly applicationContext: IApplicationContext;
    public readonly core: Core;

    public readonly discord: Client;
    public readonly logger: Logger;
    public readonly database: Database;
    public readonly dispatcher: Dispatcher;
    public readonly cache: Cache;
    public readonly session: Session;
    public readonly adapter: ExtendedAdapterClient;
    public readonly calculator: Calculator;
    public readonly metrics: Metrics;

    private destroyPromise?: Promise<void>;

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

    public destroy(): Promise<void> {
        return (this.destroyPromise ??= this.destroyInternal());
    }

    private async destroyInternal(): Promise<void> {
        const results = await Promise.allSettled([
            this.discord.destroy(),
            this.database.disconnect(),
            this.cache.disconnect(),
            Promise.resolve(this.calculator.destroy()),
        ]);

        for (const result of results) {
            if (result.status === "rejected") {
                this.logger.error(result.reason, "Shutdown task failed");
            }
        }
    }
}
