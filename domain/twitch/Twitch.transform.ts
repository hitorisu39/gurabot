export function twitchDurationSeconds(value: unknown): number {
    if (typeof value === "number") {
        return value;
    }

    if (typeof value !== "string") {
        return 0;
    }

    const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);

    if (!match) {
        return 0;
    }

    const hours = Number(match[1] ?? 0);
    const minutes = Number(match[2] ?? 0);
    const seconds = Number(match[3] ?? 0);

    return hours * 3600 + minutes * 60 + seconds;
}
