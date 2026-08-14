import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";

export class OsuTrackFormatter {
    public static pp(value: number): string {
        const rounded = DiscordFormatter.fixed(value);
        return `${DiscordFormatter.number(rounded)}pp`;
    }

    public static ppRate(value: number, period: "day" | "month"): string {
        const rounded = DiscordFormatter.fixed(value);
        const sign = rounded > 0 ? "+" : "";
        return `${sign}${DiscordFormatter.number(rounded)}pp/${period}`;
    }

    public static decay(value: number): string {
        if (value >= 100) {
            return DiscordFormatter.number(Math.round(value));
        }

        if (value >= 10) {
            return value.toFixed(1);
        }

        if (value >= 1) {
            return value.toFixed(2);
        }

        if (value >= 0.01) {
            return value.toFixed(3);
        }

        return value.toFixed(4);
    }
}
