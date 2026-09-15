import { Application } from "./app";

const shutdownTimeout = 10_000;

export function setupProcessEvents(app: Application): (reason: string, exitCode?: number) => Promise<void> {
    let shutdownPromise: Promise<void> | undefined;

    const shutdown = (reason: string, exitCode = 0): Promise<void> => {
        return (shutdownPromise ??= shutdownInternal(reason, exitCode));
    };

    const shutdownInternal = async (reason: string, exitCode: number): Promise<void> => {
        app.logger.info({ reason }, "Shutting down");

        const timeout = setTimeout(() => {
            app.logger.fatal({ reason }, "Graceful shutdown timed out");
            process.exit(1);
        }, shutdownTimeout);

        try {
            await app.destroy();
        } finally {
            clearTimeout(timeout);
        }

        process.exit(exitCode);
    };

    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));

    process.on("uncaughtException", (error) => {
        app.logger.fatal(error, "Uncaught exception");
        void shutdown("uncaughtException", 1);
    });

    process.on("unhandledRejection", (reason) => {
        app.logger.fatal(reason, "Unhandled promise rejection");
        void shutdown("unhandledRejection", 1);
    });

    return shutdown;
}
