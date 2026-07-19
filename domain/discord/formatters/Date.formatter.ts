import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import advancedFormat from "dayjs/plugin/advancedFormat";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";

dayjs.extend(duration);
dayjs.extend(advancedFormat);
dayjs.extend(relativeTime);
dayjs.extend(utc);

export class DateFormatter {
    private static parse(date?: Date | number | string) {
        if (!date) return dayjs();
        if (typeof date === "number") return dayjs.unix(date);
        return dayjs(date);
    }

    // October 22nd 2017
    public static full(date?: Date | number | string): string {
        return this.parse(date).format("MMMM Do YYYY");
    }

    // Oct 22nd 2017
    public static short(date?: Date | number | string): string {
        return this.parse(date).format("MMM Do YYYY");
    }

    // 22nd October
    public static dayMonth(date?: Date | number | string): string {
        return this.parse(date).format("Do MMMM");
    }

    // 2025-03-18
    public static iso(date?: Date | number | string): string {
        return this.parse(date).format("YYYY-MM-DD");
    }

    // 16:42
    public static time(date?: Date | number | string): string {
        return this.parse(date).format("HH:mm");
    }

    // October 22nd 2017, 16:42
    public static fullWithTime(date?: Date | number | string): string {
        return this.parse(date).format("MMMM Do YYYY, HH:mm");
    }

    // "2 hours ago"
    public static relative(date?: Date | number | string): string {
        return this.parse(date).fromNow();
    }

    // Elapsed compact age (e.g., "5y", "5mo", "12d", "2h", "15m", "now")
    public static age(date: Date | number | string): string {
        const ended = this.parse(date);
        const now = dayjs();
        const diff = now.diff(ended);
        const dur = dayjs.duration(diff);

        const years = dur.years();
        if (years > 0) return `${years}y`;

        const months = dur.months();
        if (months > 0) return `${months}mo`;

        const days = dur.days();
        if (days > 0) return `${days}d`;

        const hours = dur.hours();
        if (hours > 0) return `${hours}h`;

        const minutes = dur.minutes();
        if (minutes > 0) return `${minutes}m`;

        const seconds = dur.seconds();
        if (seconds > 0) return `${seconds}s`;

        return "now";
    }

    /**
     * t => Short time (e.g., 16:20)
     * T => Long time (e.g., 16:20:30)
     * d => Short date (e.g., 20/03/2026)
     * D => Long date (e.g., 20 March 2026)
     * f => Date + Time
     * F => Full (Weekday + Date + Time)
     * R => Relative (e.g., 2 hours ago)
     */
    public static discord(date: Date | number, format: "t" | "T" | "d" | "D" | "f" | "F" | "R" = "f") {
        const timestamp = typeof date === "number" ? Math.floor(date) : Math.floor(date.getTime() / 1000);
        return `<t:${timestamp}:${format}>`;
    }

    // Seconds → "512 hrs"
    public static hours(seconds: number, decimals: number = 0): string {
        const hrs = seconds / 3600;
        const value = decimals > 0 ? Number(hrs.toFixed(decimals)) : Math.floor(hrs);

        return `${value} hr${value !== 1 ? "s" : ""}`;
    }
}
