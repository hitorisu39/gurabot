import type { PermissionResolvable } from "discord.js";
import type { ECommandCategory } from "@domain/core/Command";
import { EComponentType } from "@domain/core/Component";
import type { AbstractCommand } from "./discord/AbstractCommand";
import type { AbstractComponent } from "./discord/AbstractComponent";
import type { AbstractDiscordEvent } from "./discord/AbstractDiscordEvent";
import type { AbstractMiddleware } from "./discord/middleware/AbstractMiddleware";
import type { IApplicationContext } from "./types";
import {
    EInjectMode,
    EOptionType,
    type ICommandOptions,
    type IComponentOptions,
    type IMiddlewareOptions,
    type IOptionMetadata,
    type ISubcommandGroupOptions,
    type ISubcommandOptions,
} from "./decorators";
import { ICoreEvents } from "./events";
export { EComponentType, EInjectMode, EOptionType };

export type TCoreConstructor<T = object> = new (ctx: IApplicationContext) => T;

export interface ICoreImport {
    target: TCoreConstructor;
    dependency: TCoreConstructor;
    propertyKey: string;
}

export interface ICoreDispatchHandler {
    target: TCoreConstructor;
    domain: keyof ICoreEvents;
    event: string;
    propertyKey: string;
}

export enum ECoreCommandKind {
    Root = "Root",
    Subcommand = "Subcommand",
}

interface ICoreCommandDefinitionBase {
    target: TCoreConstructor<AbstractCommand>;
    category?: ECommandCategory;
    guildOnly: boolean;
    noUserInstall: boolean;
    help?: string;
    examples?: ReadonlyArray<string>;
    userPermissions: ReadonlyArray<PermissionResolvable>;
    botPermissions: ReadonlyArray<PermissionResolvable>;
    properties: ReadonlyArray<IOptionMetadata>;
}

export interface ICoreRootCommandDefinition extends ICoreCommandDefinitionBase {
    kind: ECoreCommandKind.Root;
    options: ICommandOptions;
}

export interface ICoreSubcommandDefinition extends ICoreCommandDefinitionBase {
    kind: ECoreCommandKind.Subcommand;
    options: ISubcommandOptions;
}

export type TCoreCommandDefinition = ICoreRootCommandDefinition | ICoreSubcommandDefinition;

export interface ICoreMiddlewareDefinition {
    target: TCoreConstructor<AbstractMiddleware>;
    options: IMiddlewareOptions;
}

export interface ICoreComponentDefinition {
    target: TCoreConstructor<AbstractComponent>;
    options: IComponentOptions;
}

export interface ICoreDefinition {
    instances: ReadonlyArray<TCoreConstructor>;
    commands: ReadonlyArray<TCoreCommandDefinition>;
    subcommandGroups: ReadonlyArray<ISubcommandGroupOptions>;
    components: ReadonlyArray<ICoreComponentDefinition>;
    middlewares: ReadonlyArray<ICoreMiddlewareDefinition>;
    events: ReadonlyArray<TCoreConstructor<AbstractDiscordEvent<any>>>;
    imports: ReadonlyArray<ICoreImport>;
    dispatchHandlers: ReadonlyArray<ICoreDispatchHandler>;
}

export function defineCore(definition: ICoreDefinition): ICoreDefinition {
    return definition;
}

export function coreImport(target: TCoreConstructor, dependency: TCoreConstructor, propertyKey: string): ICoreImport {
    return {
        target,
        dependency,
        propertyKey,
    };
}

export function coreDispatchHandler(
    target: TCoreConstructor,
    domain: keyof ICoreEvents,
    event: string,
    propertyKey: string,
): ICoreDispatchHandler {
    return {
        target,
        domain,
        event,
        propertyKey,
    };
}
