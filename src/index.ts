import "reflect-metadata";

import { Application } from "./app";
import { getConfig } from "./env";

async function bootstrap() {
    const config = getConfig();
    const app = new Application(config);
    app.run();
}

bootstrap();
