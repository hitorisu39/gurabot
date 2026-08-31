import { EApplicationError, Exception } from "@domain/core/Exception";
import { ICommandRange } from "../core/Command";

type WaitForOptions = {
    interval?: number; // ms between checks
    timeout?: number; // max time before rejecting
};

const decimalNumberRegex = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

export function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor(
    condition: () => boolean | Promise<boolean>,
    { interval = 50, timeout = 5000 }: WaitForOptions = {},
): Promise<void> {
    const start = Date.now();

    while (true) {
        if (await condition()) return;

        if (Date.now() - start >= timeout) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "waitFor: timeout exceeded");
        }

        await wait(interval);
    }
}

export function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
    if (edge0 === edge1) return value < edge0 ? 0 : 1;

    const normalized = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return normalized * normalized * (3 - 2 * normalized);
}

export function isValidNumber(value: number | undefined | null): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

export function parseNumericString(value: string): number | null {
    const normalized = value.trim();

    if (!normalized || !decimalNumberRegex.test(normalized)) {
        return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

export function rangeContains(range: ICommandRange, value: number): boolean {
    if (range.exact !== undefined) return value === range.exact;

    const passesMin = range.minInclusive ? value >= range.min : value > range.min;
    const passesMax = range.maxInclusive ? value <= range.max : value < range.max;

    return passesMin && passesMax;
}

export function rangeInclusiveMin(range: ICommandRange, step: number): number {
    if (range.exact !== undefined) {
        return range.exact;
    }

    return range.minInclusive ? range.min : range.min + step;
}

export function rangeInclusiveMax(range: ICommandRange, step: number): number {
    if (range.exact !== undefined) {
        return range.exact;
    }

    return range.maxInclusive ? range.max : range.max - step;
}

export function levenshtein(a: string, b: string): number {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0]![j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i]![j]! = matrix[i - 1]![j - 1]!;
            } else {
                matrix[i]![j] = Math.min(
                    matrix[i - 1]![j - 1]! + 1, // substitution
                    Math.min(matrix[i]![j - 1]! + 1, matrix[i - 1]![j]! + 1), // insertion / deletion
                );
            }
        }
    }
    return matrix[b.length]![a.length]!;
}
