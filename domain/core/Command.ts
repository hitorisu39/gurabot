import type { GuildDto } from "@domain/guild/Guild.dto";
import { EApplicationError, Exception } from "./Exception";

export interface ICommandState {
    guild: GuildDto | null;
    inlineIndex?: number;
}

export enum ECommandCategory {
    General = "General",
    Osu = "Osu",
    Taiko = "Taiko",
    Catch = "Catch",
    Mania = "Mania",
}

export enum EModMatchType {
    Include = "Include",
    Match = "Match",
    Exclude = "Exclude",
}

export interface ICommandMods {
    type: EModMatchType;
    mods: string;
}

export interface ICommandQueryData<T> {
    data: T;
    cleanedContent: string;
}

export interface ICommandRange {
    min: number;
    max: number;
    minInclusive: boolean;
    maxInclusive: boolean;
    exact?: number;
}

export interface ICommandDateRange {
    min?: Date;
    max?: Date;
    minInclusive: boolean;
    maxInclusive: boolean;
    exact?: Date;
    display?: string;
}

/**
 * A class to properly interact with options passed to commands.
 */
export class CommandOption<T> {
    constructor(private readonly value: T | null | undefined) {}

    public static none<T>(): CommandOption<T> {
        return new CommandOption<T>(null);
    }

    public some(): boolean {
        return this.value !== null && this.value !== undefined;
    }

    public unwrap(): T {
        if (!this.some())
            throw new Exception(EApplicationError.INTERNAL_ERROR, "Attempted to unwrap an empty CommandOption.");

        return this.value as T;
    }

    public unwrapUnchecked(): T | null {
        return this.value as T | null;
    }

    public unwrapOr(defaultValue: T): T {
        return this.some() ? (this.value as T) : defaultValue;
    }
}

/**
 * Global command inject matcher util
 */
export class CommandMatcher {
    public static number(value: string): boolean {
        if (!value.trim()) {
            return false;
        }

        return Number.isFinite(Number(value));
    }

    public static integer(value: string): boolean {
        if (!value.trim()) {
            return false;
        }

        return Number.isInteger(Number(value));
    }

    public static positiveNumber(value: string): boolean {
        if (!CommandMatcher.number(value)) {
            return false;
        }

        return Number(value) > 0;
    }

    public static positiveInteger(value: string): boolean {
        if (!CommandMatcher.integer(value)) {
            return false;
        }

        return Number(value) > 0;
    }
}
