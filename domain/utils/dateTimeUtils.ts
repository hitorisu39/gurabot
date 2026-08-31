import { EApplicationError, Exception } from "@domain/core/Exception";
import { ICommandDateRange } from "../core/Command";

/**
 * Checks whether a Date instance contains a valid date.
 */
export function isValidDate(value: Date | null | undefined): value is Date {
    return value instanceof Date && Number.isFinite(value.getTime());
}

/**
 * Checks whether a string represents a supported UTC offset.
 *
 * Examples:
 * UTC
 * Z
 * +2
 * -5
 * +02:30
 * UTC+2
 * UTC-05:30
 */
export function isTimezoneOffset(value: string): boolean {
    const normalized = normalizeTimezone(value);

    return /^UTC[+-]\d{1,2}(?::\d{2})?$/i.test(normalized) && isValidTimezoneOffset(normalized);
}

/**
 * Normalizes a timezone offset into UTC±H[:MM].
 *
 * UTC       => UTC+0
 * Z         => UTC+0
 * +2        => UTC+2
 * -5:30     => UTC-5:30
 * UTC+2     => UTC+2
 */
export function normalizeTimezone(value?: string | null): string {
    if (!value) {
        return "UTC+0";
    }

    const normalized = value.trim();

    if (/^(?:UTC|Z)$/i.test(normalized)) {
        return "UTC+0";
    }

    if (/^UTC/i.test(normalized)) {
        return normalized.toUpperCase();
    }

    return `UTC${normalized}`;
}

/**
 * Parses a timezone offset into minutes relative to UTC.
 *
 * UTC+2      => 120
 * UTC-5      => -300
 * UTC+05:30  => 330
 * UTC        => 0
 * Z          => 0
 */
export function parseTimezoneOffset(timezone: string): number {
    const normalized = normalizeTimezone(timezone);
    const match = normalized.match(/^UTC([+-])(\d{1,2})(?::(\d{2}))?$/);

    if (!match) {
        throw new Exception(EApplicationError.INTERNAL_ERROR, `Invalid timezone offset '${timezone}'.`);
    }

    const sign = match[1] === "-" ? -1 : 1;
    const hours = Number(match[2]);
    const minutes = Number(match[3] ?? "0");

    if (
        !Number.isInteger(hours) ||
        !Number.isInteger(minutes) ||
        hours > 14 ||
        minutes > 59 ||
        (hours === 14 && minutes !== 0)
    ) {
        throw new Exception(EApplicationError.INTERNAL_ERROR, `Invalid timezone offset '${timezone}'.`);
    }

    return sign * (hours * 60 + minutes);
}

/**
 * Checks whether a date is contained within a command date range.
 */
export function dateRangeContains(range: ICommandDateRange, value: Date): boolean {
    const timestamp = value.getTime();

    if (range.exact !== undefined) {
        return timestamp === range.exact.getTime();
    }

    let passesMin = true;

    if (range.min) {
        const min = range.min.getTime();

        passesMin = range.minInclusive ? timestamp >= min : timestamp > min;
    }

    let passesMax = true;

    if (range.max) {
        const max = range.max.getTime();

        passesMax = range.maxInclusive ? timestamp <= max : timestamp < max;
    }

    return passesMin && passesMax;
}

function isValidTimezoneOffset(timezone: string): boolean {
    const match = timezone.match(/^UTC([+-])(\d{1,2})(?::(\d{2}))?$/i);

    if (!match) {
        return false;
    }

    const hours = Number(match[2]);
    const minutes = Number(match[3] ?? "0");

    return (
        Number.isInteger(hours) &&
        Number.isInteger(minutes) &&
        hours <= 14 &&
        minutes <= 59 &&
        !(hours === 14 && minutes !== 0)
    );
}
