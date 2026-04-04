import { Logger } from "@/logger";

import { IApplicationContext } from "../types";

export abstract class AbstractController {
    protected readonly logger: Logger;

    constructor(protected readonly ctx: IApplicationContext) {
        this.logger = ctx.logger.child({ name: this.constructor.name });
    }
}
