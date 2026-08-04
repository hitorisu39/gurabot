export type UnknownRecord = Record<string, unknown>;

export function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRecord(value: unknown): value is UnknownRecord {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function numberOrUndefined(value: unknown): number | undefined {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }

    try {
        const result = Number(value);
        return Number.isFinite(result) ? result : undefined;
    } catch {
        return undefined;
    }
}

export function numberOrZero(value: unknown): number {
    return numberOrUndefined(value) ?? 0;
}

export function integerOrZero(value: unknown): number {
    return Math.trunc(numberOrZero(value));
}

export function nonNegativeInteger(value: unknown): number {
    return Math.max(0, integerOrZero(value));
}

export function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}

export function booleanFromLegacy(value: unknown): boolean {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "number") {
        return value === 1;
    }

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        return normalized === "1" || normalized === "true";
    }

    return false;
}
