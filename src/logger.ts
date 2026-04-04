import pino, { Logger as PinoLogger, LoggerOptions } from "pino";
import { TConfig } from "./env";

/**
 * Application logger implementation with pino under the hood.
 */
export class Logger {
    /**
     * Pino logger instance.
     */
    private logger: PinoLogger;

    /**
     * Creates instance of pino logger.
     *
     * @param config Global application configuration
     * @param options Optional pino logger options that will overwrite default options
     */
    constructor(
        private readonly config: TConfig,
        options?: LoggerOptions,
    ) {
        const isCluster = config.app.is_cluster;
        const clusterId = config.discord.cluster.id;
        const prefix = isCluster ? `(${clusterId})` : ``;

        const targets: Array<pino.TransportTargetOptions> = [];

        if (config.app.mode !== "production" || (config.app.mode === "production" && !config.loki.enabled)) {
            targets.push({
                level: config.app.loglevel,
                target: "pino-pretty",
                options: {
                    colorize: true,
                    translateTime: "SYS:standard",
                    ignore: "pid,hostname,name",
                    messageFormat: `${prefix} [{name}] {msg}`,
                },
            });
        }

        if (config.loki.enabled) {
            targets.push({
                level: config.app.loglevel,
                target: "pino-loki",
                options: {
                    batching: true,
                    interval: 5,
                    host: config.loki.host,
                    labels: {
                        app: "gurabot",
                        cluster: clusterId,
                    },
                },
            });
        }

        const defaultOptions: LoggerOptions = {
            name: "App",
            level: config.app.loglevel,
            redact: ["token", "authorization", "secret"],
            base: {
                ...(isCluster && { cluster: clusterId }),
            },
            transport: { targets },
            ...options,
        };

        this.logger = pino(defaultOptions);
    }

    /**
     * Log with the "trace" log level
     *
     * @param args Input parameters for logging
     */
    public trace(...args: Parameters<PinoLogger["trace"]>): void {
        this.logger.trace(...args);
    }

    /**
     * Log with the "debug" log level
     *
     * @param args Input parameters for logging
     */
    public debug(...args: Parameters<PinoLogger["debug"]>): void {
        this.logger.debug(...args);
    }

    /**
     * Log with the "info" log level
     *
     * @param args Input parameters for logging
     */
    public info(...args: Parameters<PinoLogger["info"]>): void {
        this.logger.info(...args);
    }

    /**
     * Log with the "warn" log level
     *
     * @param args Input parameters for logging
     */
    public warn(...args: Parameters<PinoLogger["warn"]>): void {
        this.logger.warn(...args);
    }

    /**
     * Log with the "error" log level
     *
     * @param args Input parameters for logging
     */
    public error(...args: Parameters<PinoLogger["error"]>): void {
        this.logger.error(...args);
    }

    /**
     * Log with the "fatal" log level
     *
     * @param args Input parameters for logging
     */
    public fatal(...args: Parameters<PinoLogger["fatal"]>): void {
        this.logger.fatal(...args);
    }

    /**
     * Creates a child logger with attached context bindings.
     */
    public child(bindings: Record<string, unknown>): Logger {
        const childLogger = Object.create(Logger.prototype) as Logger;
        childLogger.logger = this.logger.child(bindings);

        return childLogger;
    }
}
