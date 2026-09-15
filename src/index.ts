import "reflect-metadata";

import { Application } from "./app";
import { getConfig } from "./env";
import { setupProcessEvents } from "./process";

async function bootstrap() {
    const app = new Application(getConfig());
    const shutdown = setupProcessEvents(app);

    try {
        await app.run();
    } catch (error) {
        app.logger.fatal(error, "Application failed to start");
        await shutdown("startup failure", 1);
    }
}

bootstrap();
