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
