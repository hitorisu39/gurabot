import { EApplicationError, Exception } from "@domain/core/Exception";

const resolutionPattern = /^\d+p$/;

export function isResolution<T extends number>(value: string, allowed: ReadonlyArray<T>): boolean {
    if (!resolutionPattern.test(value)) {
        return false;
    }

    const resolution = Number(value.slice(0, -1));

    if (!allowed.includes(resolution as T)) {
        throw new Exception(
            EApplicationError.INPUT_ERROR,
            `Unsupported resolution. Only ${formatAllowedResolutions(allowed)} are supported.`,
        );
    }

    return true;
}

export function parseResolution<T extends number>(
    value: string | null | undefined,
    allowed: ReadonlyArray<T>,
    fallback?: T,
): T {
    if (!value) {
        if (fallback !== undefined) {
            return fallback;
        }

        throw new Exception(EApplicationError.INPUT_ERROR, "Resolution is required.");
    }

    if (!resolutionPattern.test(value)) {
        throw new Exception(
            EApplicationError.INPUT_ERROR,
            `Invalid resolution. Expected ${formatAllowedResolutions(allowed)}.`,
        );
    }

    const resolution = Number(value.slice(0, -1));

    if (!allowed.includes(resolution as T)) {
        throw new Exception(
            EApplicationError.INPUT_ERROR,
            `Unsupported resolution. Only ${formatAllowedResolutions(allowed)} are supported.`,
        );
    }

    return resolution as T;
}

function formatAllowedResolutions<T extends number>(allowed: ReadonlyArray<T>): string {
    return allowed.map((resolution) => `${resolution}p`).join(" or ");
}
