import { EApplicationError, Exception } from "@domain/core/Exception";
import { EComponentType } from "@domain/core/Component";
import type { IComponentOptions } from "../decorators";
import type { ICoreComponentDefinition } from "../definition";
import { InteractionProfiler, ProfilerStorage } from "../profiler";
import { TDispatcher, TLogger, TMetrics } from "../types";
import { AbstractComponent } from "./AbstractComponent";
import { ComponentContext } from "./context/ComponentContext";

interface IRouteStore {
    strings: Map<string, AbstractComponent>;
    regexes: Array<{
        pattern: RegExp;
        instance: AbstractComponent;
    }>;
}

export class ComponentRouter {
    private readonly routes = new Map<EComponentType, IRouteStore>();
    private readonly definitions = new WeakMap<AbstractComponent, ICoreComponentDefinition>();

    constructor(
        private readonly logger: TLogger,
        private readonly dispatcher: TDispatcher,
        private readonly metrics: TMetrics,
    ) {
        this.logger = this.logger.child({
            name: "ComponentRouter",
        });

        this.dispatcher.on("discord", "component", this.handleComponent.bind(this));
    }

    private getStore(type: EComponentType): IRouteStore {
        if (!this.routes.has(type)) {
            this.routes.set(type, {
                strings: new Map(),

                regexes: [],
            });
        }

        return this.routes.get(type)!;
    }

    public register(component: AbstractComponent, definition: ICoreComponentDefinition): void {
        this.definitions.set(component, definition);

        const options = definition.options;
        const store = this.getStore(options.type);

        if (typeof options.customID === "string") {
            store.strings.set(options.customID, component);
        } else {
            store.regexes.push({
                pattern: options.customID,
                instance: component,
            });
        }

        this.logger.debug(`Registered component: [${options.type}] ${options.customID}`);
    }

    public getComponentOptions(component: AbstractComponent): IComponentOptions | undefined {
        return this.definitions.get(component)?.options;
    }

    private getIncomingComponentType(ctx: ComponentContext): EComponentType | null {
        const interaction = ctx.interaction;

        if (interaction.isModalSubmit()) {
            return EComponentType.Modal;
        }

        if (interaction.isButton()) {
            return EComponentType.Button;
        }

        if (interaction.isAnySelectMenu()) {
            return EComponentType.SelectMenu;
        }

        return null;
    }

    private async handleComponent(ctx: ComponentContext): Promise<void> {
        const incomingType = this.getIncomingComponentType(ctx);

        if (!incomingType) {
            this.logger.warn({ customID: ctx.customID }, "Received unknown component interaction type.");
            return;
        }

        const store = this.routes.get(incomingType);
        if (!store) {
            return;
        }

        let targetComponent: AbstractComponent | undefined;
        let isStringMatch = false;

        if (store.strings.has(ctx.customID)) {
            targetComponent = store.strings.get(ctx.customID);
            isStringMatch = true;
        } else {
            for (const route of store.regexes) {
                const match = ctx.customID.match(route.pattern);
                if (match) {
                    ctx.params = match.groups ?? {};
                    targetComponent = route.instance;
                    break;
                }
            }
        }

        if (!targetComponent) {
            return;
        }

        const componentName = isStringMatch ? ctx.customID : targetComponent.constructor.name;
        const profiler = new InteractionProfiler();

        await ProfilerStorage.run(profiler, async () => {
            const startTimer = this.metrics.componentHistogram.labels(componentName, "success").startTimer();

            this.logger.debug(
                { user: ctx.author.id, customID: ctx.customID, type: incomingType },
                `Executing component [${incomingType}] "${ctx.customID}"`,
            );

            try {
                await Promise.resolve(targetComponent.execute(ctx));

                const stats = profiler.end();
                startTimer();

                this.logger.debug(
                    { performance: stats },
                    `Component [${incomingType}] "${ctx.customID}" processed in ${stats.total.toFixed(2)}ms`,
                );
            } catch (error) {
                if (error instanceof Exception && error.code === EApplicationError.ACCESS_ERROR) {
                    return;
                }

                const stats = profiler.end();
                this.metrics.componentHistogram.labels(componentName, "error").observe(stats.total / 1000);

                this.logger.error(
                    { error, performance: stats },
                    `Component [${incomingType}] "${ctx.customID}" failed after ${stats.total.toFixed(2)}ms`,
                );
            }
        });
    }
}
