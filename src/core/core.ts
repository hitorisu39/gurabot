import { glob } from "glob";
import path from "path";
import { pathToFileURL } from "url";

import { AbstractCommand } from "./discord/AbstractCommand";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { METAKEY_EVENT_HANDLERS, METAKEY_IMPORTS } from "./metakeys";
import { IApplicationContext } from "./types";
import { AbstractMiddleware } from "./discord/middleware/AbstractMiddleware";
import { AbstractDiscordEvent } from "./discord/AbstractDiscordEvent";
import { AbstractComponent } from "./discord/AbstractComponent";

export class Core {
    public readonly instances = new Map<Function, any>();

    constructor(private readonly ctx: IApplicationContext) {}

    public async start(): Promise<void> {
        const base = path.resolve(__dirname, "../");
        const files = await glob(
            [
                "modules/**/*.{controller,service,middleware}.{ts,js}",
                "commands/**/*.{command,subcommand}.{ts,js}",
                "components/**/*.component.{ts,js}",
                "events/**/*.event.{ts,js}",
            ],
            {
                cwd: base,
                absolute: true,
            },
        );

        for (const file of files) {
            const url = pathToFileURL(file).href;
            const moduleExports = await import(url);

            for (const key in moduleExports) {
                const exportedClass = moduleExports[key];

                if (typeof exportedClass === "function" && exportedClass.prototype) {
                    const instance = new exportedClass(this.ctx);
                    this.instances.set(exportedClass, instance);

                    if (exportedClass.prototype instanceof AbstractCommand)
                        this.ctx.discord.commandRouter.register(instance);
                    else if (exportedClass.prototype instanceof AbstractComponent) {
                        this.ctx.discord.componentRouter.register(instance);
                    } else if (exportedClass.prototype instanceof AbstractMiddleware)
                        this.ctx.discord.commandRouter.registerMiddleware(instance);
                    else if (exportedClass.prototype instanceof AbstractDiscordEvent) {
                        if (instance.once) this.ctx.discord.once(instance.event, instance.execute.bind(instance));
                        else this.ctx.discord.on(instance.event, instance.execute.bind(instance));
                    }
                }
            }
        }

        for (const [ClassType, instance] of this.instances.entries()) {
            const imports = Reflect.getMetadata(METAKEY_IMPORTS, ClassType.prototype) || [];

            for (const { propertyKey, type } of imports) {
                const dependency = this.instances.get(type);
                if (!dependency) {
                    throw new Exception(
                        EApplicationError.INTERNAL_ERROR,
                        `[DI] Cannot find dependency '${type.name}' for '${ClassType.name}.${propertyKey}'`,
                    );
                }
                instance[propertyKey] = dependency;
            }
        }

        for (const [ClassType, instance] of this.instances.entries()) {
            const handlers = Reflect.getMetadata(METAKEY_EVENT_HANDLERS, ClassType.prototype) || [];

            for (const { domain, event, propertyKey } of handlers) {
                this.ctx.dispatcher.on(domain, event, instance[propertyKey].bind(instance));
            }
        }

        this.ctx.logger.info(`Core started: Loaded ${this.instances.size} module components.`);
    }
}
