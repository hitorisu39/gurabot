import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

import { DiscordFormatter } from "./Discord.formatter";

dayjs.extend(duration);

export class TimeFormatter {
    private static readonly second = 1000;
    private static readonly minute = 60 * TimeFormatter.second;
    private static readonly hour = 60 * TimeFormatter.minute;
    private static readonly day = 24 * TimeFormatter.hour;

    /**
     * Milliseconds -> HH:mm:ss
     *
     * 5_000        => "00:00:05"
     * 65_000       => "00:01:05"
     * 3_661_000    => "01:01:01"
     */
    public static clock(milliseconds: number): string {
        const totalseconds = Math.floor(Math.max(0, milliseconds) / 1000);

        const hours = Math.floor(totalseconds / 3600);
        const minutes = Math.floor((totalseconds % 3600) / 60);
        const seconds = totalseconds % 60;

        return [
            hours.toString().padStart(2, "0"),
            minutes.toString().padStart(2, "0"),
            seconds.toString().padStart(2, "0"),
        ].join(":");
    }

    /**
     * Milliseconds -> mm:ss
     *
     * 5_000       => "00:05"
     * 65_000      => "01:05"
     * 3_661_000   => "61:01"
     */
    public static clockShort(milliseconds: number): string {
        const totalseconds = Math.floor(Math.max(0, milliseconds) / 1000);

        const minutes = Math.floor(totalseconds / 60);
        const seconds = totalseconds % 60;

        return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }

    /**
     * seconds -> HH:mm:ss
     */
    public static secondsClock(seconds: number): string {
        return TimeFormatter.clock(seconds * 1000);
    }

    /**
     * Compact duration.
     *
     * 500                 => "now"
     * 30_000              => "30s"
     * 120_000             => "2m"
     * 7_200_000           => "2h"
     * 172_800_000         => "2d"
     */
    public static compact(milliseconds: number): string {
        const value = Math.max(0, milliseconds);

        if (value >= TimeFormatter.day) {
            return `${Math.floor(value / TimeFormatter.day)}d`;
        }

        if (value >= TimeFormatter.hour) {
            return `${Math.floor(value / TimeFormatter.hour)}h`;
        }

        if (value >= TimeFormatter.minute) {
            return `${Math.floor(value / TimeFormatter.minute)}m`;
        }

        if (value >= TimeFormatter.second) {
            return `${Math.floor(value / TimeFormatter.second)}s`;
        }

        return "now";
    }

    /**
     * Compact duration with multiple units.
     *
     * 65_000       => "1m 5s"
     * 3_661_000    => "1h 1m 1s"
     * 90_061_000   => "1d 1h 1m"
     */
    public static compactFull(milliseconds: number, maxParts: number = 3): string {
        let remaining = Math.floor(Math.max(0, milliseconds) / 1000);

        if (remaining === 0) {
            return "now";
        }

        const days = Math.floor(remaining / 86_400);
        remaining %= 86_400;

        const hours = Math.floor(remaining / 3_600);
        remaining %= 3_600;

        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;

        const parts: Array<string> = [];

        if (days > 0) {
            parts.push(`${days}d`);
        }

        if (hours > 0) {
            parts.push(`${hours}h`);
        }

        if (minutes > 0) {
            parts.push(`${minutes}m`);
        }

        if (seconds > 0) {
            parts.push(`${seconds}s`);
        }

        return parts.slice(0, Math.max(1, maxParts)).join(" ");
    }

    /**
     * Human-readable duration.
     *
     * 1_000        => "1 second"
     * 90_000       => "1 minute 30 seconds"
     * 7_200_000    => "2 hours"
     */
    public static human(milliseconds: number, maxParts: number = 2): string {
        let remaining = Math.floor(Math.max(0, milliseconds) / 1000);

        if (remaining === 0) {
            return "0 seconds";
        }

        const units = [
            {
                name: "day",
                seconds: 86_400,
            },
            {
                name: "hour",
                seconds: 3_600,
            },
            {
                name: "minute",
                seconds: 60,
            },
            {
                name: "second",
                seconds: 1,
            },
        ] as const;

        const parts: Array<string> = [];

        for (const unit of units) {
            if (remaining < unit.seconds) {
                continue;
            }

            const amount = Math.floor(remaining / unit.seconds);
            remaining %= unit.seconds;

            parts.push(`${DiscordFormatter.number(amount)} ${unit.name}${amount === 1 ? "" : "s"}`);

            if (parts.length >= maxParts) {
                break;
            }
        }

        return parts.join(" ");
    }

    /**
     * Approximate duration.
     *
     * 30_000          => "30 seconds"
     * 90_000          => "2 minutes"
     * 5_400_000       => "2 hours"
     * 172_800_000     => "2 days"
     */
    public static approximate(milliseconds: number): string {
        const value = Math.max(0, milliseconds);

        if (value < TimeFormatter.minute) {
            const seconds = Math.max(1, Math.round(value / TimeFormatter.second));
            return `${DiscordFormatter.number(seconds)} second${seconds === 1 ? "" : "s"}`;
        }

        if (value < TimeFormatter.hour) {
            const minutes = Math.round(value / TimeFormatter.minute);
            return `${DiscordFormatter.number(minutes)} minute${minutes === 1 ? "" : "s"}`;
        }

        if (value < TimeFormatter.day) {
            const hours = Math.round(value / TimeFormatter.hour);
            return `${DiscordFormatter.number(hours)} hour${hours === 1 ? "" : "s"}`;
        }

        const days = Math.round(value / TimeFormatter.day);
        return `${DiscordFormatter.number(days)} day${days === 1 ? "" : "s"}`;
    }

    /**
     * Milliseconds -> decimal seconds.
     *
     * 1_500 => 1.5
     */
    public static seconds(milliseconds: number, decimals: number = 0): number {
        return DiscordFormatter.fixed(milliseconds / TimeFormatter.second, decimals);
    }

    /**
     * Milliseconds -> decimal minutes.
     */
    public static minutes(milliseconds: number, decimals: number = 0): number {
        return DiscordFormatter.fixed(milliseconds / TimeFormatter.minute, decimals);
    }

    /**
     * Milliseconds -> decimal hours.
     */
    public static hours(milliseconds: number, decimals: number = 0): number {
        return DiscordFormatter.fixed(milliseconds / TimeFormatter.hour, decimals);
    }

    /**
     * Milliseconds -> decimal days.
     */
    public static days(milliseconds: number, decimals: number = 0): number {
        return DiscordFormatter.fixed(milliseconds / TimeFormatter.day, decimals);
    }

    /**
     * seconds -> milliseconds.
     */
    public static fromSeconds(seconds: number): number {
        return seconds * TimeFormatter.second;
    }

    /**
     * minutes -> milliseconds.
     */
    public static fromMinutes(minutes: number): number {
        return minutes * TimeFormatter.minute;
    }

    /**
     * hours -> milliseconds.
     */
    public static fromHours(hours: number): number {
        return hours * TimeFormatter.hour;
    }

    /**
     * days -> milliseconds.
     */
    public static fromDays(days: number): number {
        return days * TimeFormatter.day;
    }

    /**
     * HH:MM (e.g., 09:00)
     */
    public static hourMinute(hour: number, minute: number = 0): string {
        return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
    }

    /**
     * Converts a duration into Discord-friendly text.
     *
     * 3_661_000 => "1 hr, 1 min, 1 sec"
     */
    public static discord(milliseconds: number): string {
        let remaining = Math.floor(Math.max(0, milliseconds) / 1000);

        const days = Math.floor(remaining / 86_400);
        remaining %= 86_400;

        const hours = Math.floor(remaining / 3_600);
        remaining %= 3_600;

        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;

        const parts: Array<string> = [];

        if (days > 0) {
            parts.push(`${DiscordFormatter.number(days)} day${days === 1 ? "" : "s"}`);
        }

        if (hours > 0) {
            parts.push(`${DiscordFormatter.number(hours)} hr${hours === 1 ? "" : "s"}`);
        }

        if (minutes > 0) {
            parts.push(`${DiscordFormatter.number(minutes)} min${minutes === 1 ? "" : "s"}`);
        }

        if (seconds > 0) {
            parts.push(`${DiscordFormatter.number(seconds)} sec${seconds === 1 ? "" : "s"}`);
        }

        return parts.length > 0 ? parts.join(", ") : "0 secs";
    }
}
