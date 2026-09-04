import { EApplicationError, Exception } from "@domain/core/Exception";
import { IApplicationContext, TConstructor } from "./types";
import { ICoreDispatchHandler, ICoreImport, TCoreConstructor } from "./definition";
import { ClientEvents } from "discord.js";
import { AbstractDiscordEvent } from "./discord/AbstractDiscordEvent";

export class Core {
    public readonly instances = new Map<TCoreConstructor, object>();

    constructor(private readonly ctx: IApplicationContext) {}

    public async start(): Promise<void> {
        const { core } = await import("@generated/core/index.js");

        for (const ClassType of core.instances) {
            this.instances.set(ClassType, new ClassType(this.ctx));
        }

        this.injectDependencies(core.imports);
        this.registerEventHandlers(core.dispatchHandlers);

        for (const options of core.subcommandGroups) {
            this.ctx.discord.commandRouter.registerSubcommandGroup(options);
        }

        for (const definition of core.commands) {
            this.ctx.discord.commandRouter.register(this.getInstance(definition.target), definition);
        }

        for (const definition of core.components) {
            this.ctx.discord.componentRouter.register(this.getInstance(definition.target), definition);
        }

        for (const definition of core.middlewares) {
            this.ctx.discord.commandRouter.registerMiddleware(this.getInstance(definition.target), definition);
        }

        for (const ClassType of core.events) {
            this.registerDiscordEvent(this.getInstance(ClassType));
        }

        this.ctx.logger.info(`Core started: Loaded ${this.instances.size} module components.`);
    }

    private injectDependencies(imports: ReadonlyArray<ICoreImport>): void {
        for (const entry of imports) {
            const target = this.getInstance(entry.target);
            const dependency = this.getInstance(entry.dependency);
            const injected = Reflect.set(target, entry.propertyKey, dependency);

            if (!injected) {
                throw new Exception(
                    EApplicationError.INTERNAL_ERROR,
                    `[DI] Cannot inject '${entry.dependency.name}' into '${entry.target.name}.${entry.propertyKey}'.`,
                );
            }
        }
    }

    private registerEventHandlers(handlers: ReadonlyArray<ICoreDispatchHandler>): void {
        for (const entry of handlers) {
            const instance = this.getInstance(entry.target);
            const handler = Reflect.get(instance, entry.propertyKey);

            if (typeof handler !== "function") {
                throw new Exception(
                    EApplicationError.INTERNAL_ERROR,
                    `[Core] Event handler '${entry.target.name}.${entry.propertyKey}' is not a function.`,
                );
            }

            this.registerEventHandler(entry, handler.bind(instance));
        }
    }

    private registerEventHandler(entry: ICoreDispatchHandler, handler: (...args: Array<any>) => any): void {
        this.ctx.dispatcher.on(entry.domain as never, entry.event as never, handler as never);
    }

    private registerDiscordEvent<K extends keyof ClientEvents>(instance: AbstractDiscordEvent<K>): void {
        const handler = instance.execute.bind(instance);

        if (instance.once) {
            this.ctx.discord.once(instance.event, handler);
        } else {
            this.ctx.discord.on(instance.event, handler);
        }
    }

    private getInstance<T extends TConstructor<any>>(ClassType: T): InstanceType<T> {
        const instance = this.instances.get(ClassType);

        if (!instance) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                `[Core] Instance '${ClassType.name}' does not exist.`,
            );
        }

        return instance as InstanceType<T>;
    }
}
