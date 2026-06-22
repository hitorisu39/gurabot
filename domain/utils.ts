import { EApplicationError, Exception } from "@domain/core/Exception";
import { ICommandDateRange, ICommandRange } from "./core/Command";

type WaitForOptions = {
    interval?: number; // ms between checks
    timeout?: number; // max time before rejecting
};

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

export function rangeContains(range: ICommandRange, value: number): boolean {
    if (range.exact !== undefined) return value === range.exact;

    const passesMin = range.minInclusive ? value >= range.min : value > range.min;
    const passesMax = range.maxInclusive ? value <= range.max : value < range.max;

    return passesMin && passesMax;
}

export function dateRangeContains(range: ICommandDateRange, value: Date): boolean {
    if (range.exact !== undefined) return value.getTime() === range.exact.getTime();

    let passesMin = true;
    if (range.min) {
        passesMin = range.minInclusive ? value.getTime() >= range.min.getTime() : value.getTime() > range.min.getTime();
    }

    let passesMax = true;
    if (range.max) {
        passesMax = range.maxInclusive ? value.getTime() <= range.max.getTime() : value.getTime() < range.max.getTime();
    }

    return passesMin && passesMax;
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
                    Math.min(matrix[i]![j - 1]! + 1, matrix[i - 1]![j]! + 1) // insertion / deletion
                );
            }
        }
    }
    return matrix[b.length]![a.length]!;
}