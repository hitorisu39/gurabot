import { IApplicationEvents } from "@/common/events";
import "reflect-metadata";

import {
    METAKEY_BOT_PERMISSIONS,
    METAKEY_COMMAND_CATEGORY,
    METAKEY_COMMAND_EXAMPLES,
    METAKEY_COMMAND_HELP,
    METAKEY_COMMAND_OPTIONS,
    METAKEY_COMMAND_PROPERTIES,
    METAKEY_COMPONENT_OPTIONS,
    METAKEY_EVENT_HANDLERS,
    METAKEY_GUILD_ONLY,
    METAKEY_IMPORTS,
    METAKEY_MIDDLEWARE_OPTIONS,
    METAKEY_NO_USER_INSTALL,
    METAKEY_SUBCOMMAND_GROUP_OPTIONS,
    METAKEY_SUBCOMMAND_OPTIONS,
    METAKEY_USER_PERMISSIONS,
} from "./metakeys";
import { PermissionResolvable } from "discord.js";
import { EComponentType } from "@domain/core/Component";
import { ProfilerStorage } from "./profiler";
import { ECommandCategory } from "@domain/core/Command";

type Awaitable<T> = T | Promise<T>;
type EventHandler<T> = T extends (...args: infer A) => infer R ? (...args: A) => Awaitable<R> : never;

export function Import(): PropertyDecorator {
    return (target: Object, propertyKey: string | symbol) => {
        const type = Reflect.getMetadata("design:type", target, propertyKey);
        const imports = Reflect.getMetadata(METAKEY_IMPORTS, target) || [];
        imports.push({ propertyKey, type });
        Reflect.defineMetadata(METAKEY_IMPORTS, imports, target);
    };
}

export function On<D extends keyof IApplicationEvents, E extends keyof IApplicationEvents[D]>(domain: D, event: E) {
    return function <T extends EventHandler<IApplicationEvents[D][E]>>(
        target: any,
        propertyKey: string,
        descriptor: TypedPropertyDescriptor<T>,
    ) {
        const eventHandlers = Reflect.getMetadata(METAKEY_EVENT_HANDLERS, target) || [];
        eventHandlers.push({ domain, event, propertyKey });
        Reflect.defineMetadata(METAKEY_EVENT_HANDLERS, eventHandlers, target);
    };
}

//#region Commands

export interface ICommandOptions {
    name: string;
    description: string;
    aliases?: Array<string>;
    cooldown?: number; // In seconds, defaults to 2.
    defer?: boolean; // Auto-defer before execution.
    ephemeral?: boolean; // If deferred, should it be hidden.
    prefixOnly?: boolean;
    slashOnly?: boolean;
}

export interface ISubcommandOptions {
    root: string;
    group?: string;
    name: string;
    description: string;
    aliases?: Array<string>;
    cooldown?: number;
    defer?: boolean;
    ephemeral?: boolean;
    prefixOnly?: boolean;
}

export interface ISubcommandGroupOptions {
    root: string;
    name: string;
    description: string;
}

export interface ICommandMetadata {
    options: ICommandOptions | ISubcommandOptions;
    guildOnly: boolean;
    userPermissions: Array<PermissionResolvable>;
    botPermissions: Array<PermissionResolvable>;
}

export function Command(options: ICommandOptions): ClassDecorator {
    return (target: Function) => {
        Reflect.defineMetadata(METAKEY_COMMAND_OPTIONS, options, target);
    };
}

export function Subcommand(options: ISubcommandOptions): ClassDecorator {
    return (target) => {
        Reflect.defineMetadata(METAKEY_SUBCOMMAND_OPTIONS, options, target);
    };
}

export function SubcommandGroup(options: ISubcommandGroupOptions): ClassDecorator {
    return (target: Function) => {
        Reflect.defineMetadata(METAKEY_SUBCOMMAND_GROUP_OPTIONS, options, target);
    };
}

export function Help(text: string): ClassDecorator {
    return (target: Function) => {
        Reflect.defineMetadata(METAKEY_COMMAND_HELP, text, target);
    };
}

export function Examples(...examples: Array<string>): ClassDecorator {
    return (target: Function) => {
        Reflect.defineMetadata(METAKEY_COMMAND_EXAMPLES, examples, target);
    };
}

export function Category(category: ECommandCategory): ClassDecorator {
    return (target: Function) => {
        Reflect.defineMetadata(METAKEY_COMMAND_CATEGORY, category, target);
    };
}

/**
 * Restricts this command or subcommand to be used only inside a Guild (Server).
 */
export function GuildOnly(): ClassDecorator {
    return (target: Function) => {
        Reflect.defineMetadata(METAKEY_GUILD_ONLY, true, target);
    };
}

/**
 * Defines the permissions the USER needs to execute this command/subcommand.
 */
export function UserPermissions(...permissions: Array<PermissionResolvable>): ClassDecorator {
    return (target: Function) => {
        Reflect.defineMetadata(METAKEY_USER_PERMISSIONS, permissions, target);
    };
}

/**
 * Defines the permissions the BOT needs to execute this command/subcommand.
 */
export function BotPermissions(...permissions: Array<PermissionResolvable>): ClassDecorator {
    return (target: Function) => {
        Reflect.defineMetadata(METAKEY_BOT_PERMISSIONS, permissions, target);
    };
}

/**
 * Prevents a root command from being available through a user installation.
 *
 * The command remains available when the app is installed to a guild.
 *
 * This decorator cannot be applied to individual subcommands because Discord
 * defines installation types on the root application command.
 */
export function NoUserInstall(): ClassDecorator {
    return (target: Function) => {
        Reflect.defineMetadata(METAKEY_NO_USER_INSTALL, true, target);
    };
}

//#endregion

//#region Command Options

export enum EOptionType {
    String = "String",
    Number = "Number",
    Integer = "Integer",
    Range = "Range",
    Enum = "Enum",
    Boolean = "Boolean",
    User = "User",
    Attachment = "Attachment",
    Mods = "Mods",
    Query = "Query",
    Date = "Date",
    DateRange = "DateRange",
}

export enum EInjectMode {
    Greedy = "Greedy",
    Token = "Token",
    Match = "Match",
}

export interface IOptionMetadata {
    propertyKey: string;
    name: string;
    description: string;
    type: EOptionType;
    required: boolean;

    inject?: EInjectMode;
    injectMatcher?: (value: string) => boolean;

    min?: number;
    max?: number;
    enumData?: any;
    aliases?: Array<string>;
    queryDto?: any;
    isInlineIndex?: boolean;
    autocomplete?: boolean;
}

function getOrCreateProperties(target: any): Array<IOptionMetadata> {
    let properties = Reflect.getOwnMetadata(METAKEY_COMMAND_PROPERTIES, target);
    if (!properties) {
        const parentProperties = Reflect.getMetadata(METAKEY_COMMAND_PROPERTIES, target) || [];
        properties = parentProperties.map((p: any) => ({ ...p }));
        Reflect.defineMetadata(METAKEY_COMMAND_PROPERTIES, properties, target);
    }
    return properties;
}

function updateProperty(target: any, propertyKey: string | symbol, update: Partial<IOptionMetadata>) {
    const properties = getOrCreateProperties(target);
    const existing = properties.find((p) => p.propertyKey === propertyKey);
    if (existing) {
        Object.assign(existing, update);
    } else {
        properties.push({ propertyKey: propertyKey.toString(), required: false, inject: false, ...update } as any);
    }
}

export function Option(name: string, description: string) {
    return function (target: any, propertyKey: string | symbol) {
        updateProperty(target, propertyKey, { name, description });
    };
}

export function Required() {
    return function (target: any, propertyKey: string | symbol) {
        updateProperty(target, propertyKey, { required: true });
    };
}

export function Autocomplete() {
    return function (target: any, propertyKey: string | symbol) {
        updateProperty(target, propertyKey, { autocomplete: true });
    };
}

export function Inject() {
    return function (target: any, propertyKey: string | symbol) {
        updateProperty(target, propertyKey, {
            inject: EInjectMode.Greedy,
        });
    };
}

export function InjectToken() {
    return function (target: any, propertyKey: string | symbol) {
        updateProperty(target, propertyKey, {
            inject: EInjectMode.Token,
        });
    };
}

export function InjectMatch(matcher: (value: string) => boolean) {
    return function (target: any, propertyKey: string | symbol) {
        updateProperty(target, propertyKey, {
            inject: EInjectMode.Match,
            injectMatcher: matcher,
        });
    };
}

export function Aliases(...aliases: Array<string>) {
    return function (target: any, propertyKey: string | symbol) {
        updateProperty(target, propertyKey, { aliases: aliases.map((a) => a.toLowerCase()) });
    };
}

export function IsMods() {
    return function (target: any, propertyKey: string | symbol) {
        updateProperty(target, propertyKey, { type: EOptionType.Mods });
    };
}

export function IsQuery(dtoClass: any) {
    return function (target: any, propertyKey: string | symbol) {
        updateProperty(target, propertyKey, { type: EOptionType.Query, queryDto: dtoClass });
    };
}

export function IsInlineIndex() {
    return function (target: any, propertyKey: string | symbol) {
        updateProperty(target, propertyKey, { isInlineIndex: true });
    };
}

export function IsString(minLength?: number, maxLength?: number) {
    return function (target: any, propertyKey: string | symbol) {
        updateProperty(target, propertyKey, { type: EOptionType.String, min: minLength, max: maxLength });
    };
}

export function IsNumber(min?: number, max?: number) {
    return function (target: any, propertyKey: string | symbol) {
        updateProperty(target, propertyKey, { type: EOptionType.Number, min, max });
    };
}

export function IsInteger(min?: number, max?: number) {
    return function (target: any, propertyKey: string | symbol) {
        updateProperty(target, propertyKey, { type: EOptionType.Integer, min, max });
    };
}

export function IsRange(min?: number, max?: number) {
    return function (target: any, propertyKey: string | symbol) {
        updateProperty(target, propertyKey, { type: EOptionType.Range });
    };
}

export function IsEnum(enumObj: any) {
    return function (target: any, propertyKey: string | symbol) {
        updateProperty(target, propertyKey, { type: EOptionType.Enum, enumData: enumObj });
    };
}

export function IsBoolean() {
    return function (target: any, propertyKey: string | symbol) {
        updateProperty(target, propertyKey, { type: EOptionType.Boolean });
    };
}

export function IsUser() {
    return function (target: any, propertyKey: string | symbol) {
        updateProperty(target, propertyKey, { type: EOptionType.User });
    };
}

export function IsAttachment() {
    return function (target: any, propertyKey: string | symbol) {
        updateProperty(target, propertyKey, { type: EOptionType.Attachment });
    };
}

export function IsDate() {
    return function (target: any, propertyKey: string | symbol) {
        updateProperty(target, propertyKey, { type: EOptionType.Date });
    };
}

export function IsDateRange() {
    return function (target: any, propertyKey: string | symbol) {
        updateProperty(target, propertyKey, { type: EOptionType.DateRange });
    };
}

//#endregion

//#region Middleware

export interface IMiddlewareOptions {
    /**
     * Lower numbers execute earlier.
     * E.g., Priority 10 runs before Priority 50.
     * Default: 50
     */
    priority?: number;
}

export function Middleware(options?: IMiddlewareOptions) {
    return function (target: Function) {
        Reflect.defineMetadata(METAKEY_MIDDLEWARE_OPTIONS, options || {}, target);
    };
}

//#endregion

//#region Components

export interface IComponentOptions {
    customID: string | RegExp;
    type: EComponentType;
}

export function Component(options: IComponentOptions): ClassDecorator {
    return (target: Function) => {
        Reflect.defineMetadata(METAKEY_COMPONENT_OPTIONS, options, target);
    };
}

export function Button(customID: string | RegExp): ClassDecorator {
    return Component({ customID, type: EComponentType.Button });
}

export function SelectMenu(customID: string | RegExp): ClassDecorator {
    return Component({ customID, type: EComponentType.SelectMenu });
}

export function Modal(customID: string | RegExp): ClassDecorator {
    return Component({ customID, type: EComponentType.Modal });
}

//#endregion

//#region Profiler

export function Trace(stepName?: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        const name = stepName ?? `${target.constructor.name}.${propertyKey}`;

        descriptor.value = function (...args: any[]) {
            const profiler = ProfilerStorage.getStore();

            if (!profiler) return originalMethod.apply(this, args);

            const start = performance.now();
            const result = originalMethod.apply(this, args);

            if (result instanceof Promise) {
                return result.finally(() => profiler.record(name, performance.now() - start));
            } else {
                profiler.record(name, performance.now() - start);
                return result;
            }
        };

        return descriptor;
    };
}

//#endregion
