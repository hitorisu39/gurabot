import { isValidNumber } from "@domain/utils";
import { TransformationType, TransformFnParams } from "class-transformer";

export function transformAccuracy({ value, type }: TransformFnParams): number {
    const accuracy = Number(value);

    if (!isValidNumber(accuracy)) {
        return accuracy;
    }

    switch (type) {
        case TransformationType.PLAIN_TO_CLASS:
            return accuracy * 100;
        case TransformationType.CLASS_TO_PLAIN:
            return accuracy / 100;
        default:
            return accuracy;
    }
}

export function transformMods({ value, type }: TransformFnParams): string | null {
    if (value === null || value === undefined) {
        return null;
    }

    const mods = String(value);
    switch (type) {
        case TransformationType.PLAIN_TO_CLASS:
            return mods.toLowerCase() === "nomod" ? "NM" : mods.toUpperCase();
        case TransformationType.CLASS_TO_PLAIN:
            return mods === "NM" ? "nomod" : mods;
        default:
            return mods;
    }
}

export function transformModCounts({ value }: TransformFnParams): Record<string, number> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    const transformed: Record<string, number> = {};

    for (const [mods, rawCount] of Object.entries(value)) {
        const count = Number(rawCount);
        if (!isValidNumber(count)) {
            continue;
        }

        transformed[mods === "nomod" ? "NM" : mods] = count;
    }

    return transformed;
}

export function transformStarRatingSpread({ value }: TransformFnParams): Record<string, number> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    const transformed: Record<string, number> = {};

    for (const [stars, rawCount] of Object.entries(value)) {
        transformed[stars] = rawCount === null ? 0 : Number(rawCount);
    }

    return transformed;
}

export function transformCountryCode({ value }: TransformFnParams): string {
    return typeof value === "string" ? value.toUpperCase() : value;
}
