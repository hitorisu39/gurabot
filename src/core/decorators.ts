import type { ICoreEvents } from "@/core/events";
import type { PermissionResolvable } from "discord.js";

import { EComponentType } from "@domain/core/Component";
import { ECommandCategory } from "@domain/core/Command";
import { ProfilerStorage } from "./profiler";

type Awaitable<T> = T | Promise<T>;
type EventHandler<T> = T extends (...args: infer A) => infer R ? (...args: A) => Awaitable<R> : never;

export function Import(): PropertyDecorator {
    return () => {};
}

export function On<D extends keyof ICoreEvents, E extends keyof ICoreEvents[D]>(_domain: D, _event: E) {
    return function <T extends EventHandler<ICoreEvents[D][E]>>(
        _target: any,
        _propertyKey: string,
        _descriptor: TypedPropertyDescriptor<T>,
    ): void {};
}

//#region Commands

export interface ICommandOptions {
    name: string;
    description: string;
    aliases?: Array<string>;
    cooldown?: number;
    defer?: boolean;
    ephemeral?: boolean;
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
    userPermissions: ReadonlyArray<PermissionResolvable>;
    botPermissions: ReadonlyArray<PermissionResolvable>;
}

export function Command(_options: ICommandOptions): ClassDecorator {
    return () => {};
}

export function Subcommand(_options: ISubcommandOptions): ClassDecorator {
    return () => {};
}

export function SubcommandGroup(_options: ISubcommandGroupOptions): ClassDecorator {
    return () => {};
}

export function Help(_text: string): ClassDecorator {
    return () => {};
}

export function Examples(..._examples: Array<string>): ClassDecorator {
    return () => {};
}

export function Category(_category: ECommandCategory): ClassDecorator {
    return () => {};
}

export function GuildOnly(): ClassDecorator {
    return () => {};
}

export function UserPermissions(..._permissions: Array<PermissionResolvable>): ClassDecorator {
    return () => {};
}

export function BotPermissions(..._permissions: Array<PermissionResolvable>): ClassDecorator {
    return () => {};
}

export function NoUserInstall(): ClassDecorator {
    return () => {};
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
    ModsArray = "ModsArray",
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
    queryProperties?: ReadonlyArray<IOptionMetadata>;
    isInlineIndex?: boolean;
    autocomplete?: boolean;
}

export function Option(_name: string, _description: string): PropertyDecorator {
    return () => {};
}

export function Required(): PropertyDecorator {
    return () => {};
}

export function Autocomplete(): PropertyDecorator {
    return () => {};
}

export function Inject(): PropertyDecorator {
    return () => {};
}

export function InjectToken(): PropertyDecorator {
    return () => {};
}

export function InjectMatch(_matcher: (value: string) => boolean): PropertyDecorator {
    return () => {};
}

export function Aliases(..._aliases: Array<string>): PropertyDecorator {
    return () => {};
}

export function IsMods(): PropertyDecorator {
    return () => {};
}

export function IsModsArray(): PropertyDecorator {
    return () => {};
}

export function IsQuery(_dtoClass: any): PropertyDecorator {
    return () => {};
}

export function IsInlineIndex(): PropertyDecorator {
    return () => {};
}

export function IsString(_minLength?: number, _maxLength?: number): PropertyDecorator {
    return () => {};
}

export function IsNumber(_min?: number, _max?: number): PropertyDecorator {
    return () => {};
}

export function IsInteger(_min?: number, _max?: number): PropertyDecorator {
    return () => {};
}

export function IsRange(_min?: number, _max?: number): PropertyDecorator {
    return () => {};
}

export function IsEnum(_enumObj: any): PropertyDecorator {
    return () => {};
}

export function IsBoolean(): PropertyDecorator {
    return () => {};
}

export function IsUser(): PropertyDecorator {
    return () => {};
}

export function IsAttachment(): PropertyDecorator {
    return () => {};
}

export function IsDate(): PropertyDecorator {
    return () => {};
}

export function IsDateRange(): PropertyDecorator {
    return () => {};
}

//#endregion

//#region Middleware

export interface IMiddlewareOptions {
    /**
     * Lower numbers execute earlier.
     *
     * Default: 50
     */
    priority?: number;
}

export function Middleware(_options?: IMiddlewareOptions): ClassDecorator {
    return () => {};
}

//#endregion

//#region Components

export interface IComponentOptions {
    customID: string | RegExp;
    type: EComponentType;
}

export function Component(_options: IComponentOptions): ClassDecorator {
    return () => {};
}

export function Button(_customID: string | RegExp): ClassDecorator {
    return () => {};
}

export function SelectMenu(_customID: string | RegExp): ClassDecorator {
    return () => {};
}

export function Modal(_customID: string | RegExp): ClassDecorator {
    return () => {};
}

//#endregion

//#region Profiler

export function Trace(stepName?: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        const name = stepName ?? `${target.constructor.name}.${propertyKey}`;

        descriptor.value = function (...args: any[]) {
            const profiler = ProfilerStorage.getStore();
            if (!profiler) {
                return originalMethod.apply(this, args);
            }

            const start = performance.now();
            const result = originalMethod.apply(this, args);

            if (result instanceof Promise) {
                return result.finally(() => profiler.record(name, performance.now() - start));
            }

            profiler.record(name, performance.now() - start);
            return result;
        };

        return descriptor;
    };
}

//#endregion
