import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { TextFormatter } from "@domain/discord/formatters/Text.formatter";
import { OsekaiMedalDto } from "@domain/osekai/OsekaiMedal.dto";
import { MapFormatter } from "./Map.formatter";
import { ProfileFormatter } from "./Profile.formatter";
import { GameMode } from "@generated/adapter/types";
import { isValidDate } from "@domain/utils/dateTimeUtils";

export class MedalFormatter {
    public static text(value: string | null): string | null {
        if (!value) {
            return null;
        }

        const formatted = value.replace(
            /<star-rating>\s*(\d+(?:\.\d+)?)(.*?)<\/star-rating>/gi,
            (_, rawStars: string, suffix: string) => {
                const stars = MapFormatter.stars(Number(rawStars));

                return `${stars}${suffix.trim()}`;
            },
        );

        return TextFormatter.htmlToMarkdown(formatted);
    }

    public static solution(medal: OsekaiMedalDto): string {
        const solution = this.text(medal.solution);

        if (solution) {
            return solution;
        }

        if (!medal.solutionFound) {
            return "The solution hasn't been discovered yet.";
        }

        return "No solution has been provided.";
    }

    public static solutionField(medal: OsekaiMedalDto, spoil: boolean): string {
        const solution = this.solution(medal);
        const value = this.fieldValue(solution, medal.url(), spoil ? 1020 : 1024);
        return spoil ? `||${value}||` : value;
    }

    public static frequency(medal: OsekaiMedalDto): string {
        if (medal.frequency === null) {
            return "Unknown";
        }

        return `${medal.frequency.toFixed(2)}%`;
    }

    public static rarity(medal: OsekaiMedalDto): string {
        const frequency = medal.frequency !== null ? `**${this.frequency(medal)}**` : "Unknown";
        return [frequency, DiscordFormatter.quantity(medal.achievedBy, "achiever")].join("\n");
    }

    public static requirements(medal: OsekaiMedalDto): string {
        const mode = this.gamemode(medal.gamemode);
        const modeText = mode ? ProfileFormatter.mode(mode, true) : "any mode";
        const mods = medal.mods?.length ? `mods: ${medal.mods}` : "any mods";
        return `-# ${modeText} • ${mods}`;
    }

    public static availability(medal: OsekaiMedalDto): string {
        return [`${medal.supportsStable ? "✅" : "❌"} Stable`, `${medal.supportsLazer ? "✅" : "❌"} Lazer`].join(
            "\n",
        );
    }

    public static firstAchieved(medal: OsekaiMedalDto): string {
        const values: Array<string> = [];

        if (medal.firstAchievedUsername) {
            if (medal.firstAchievedUserID) {
                values.push(
                    DiscordFormatter.link(
                        medal.firstAchievedUsername,
                        `https://osu.ppy.sh/users/${medal.firstAchievedUserID}`,
                    ),
                );
            } else {
                values.push(medal.firstAchievedUsername);
            }
        }

        if (isValidDate(medal.firstAchievedAt)) {
            values.push(DateFormatter.discord(medal.firstAchievedAt, "R"));
        }

        return values.join("\n") || "Unknown";
    }

    public static footer(medal: OsekaiMedalDto): string {
        const values = ["Osekai"];

        if (medal.grouping) {
            values.push(medal.grouping);
        }

        if (isValidDate(medal.releasedAt)) {
            values.push(`Released ${DateFormatter.shortDate(medal.releasedAt)}`);
        }

        return values.join(" • ");
    }

    public static gamemode(gamemode: string | null): GameMode | null {
        if (!gamemode) {
            return null;
        }

        switch (gamemode.toLowerCase()) {
            case "osu":
                return GameMode.Standard;
            case "taiko":
                return GameMode.Taiko;
            case "catch":
                return GameMode.Catch;
            case "mania":
                return GameMode.Mania;
            default:
                return null;
        }
    }

    public static fieldValue(value: string, medalURL: string, maxLength: number = 1024): string {
        const suffix = `\n\n${DiscordFormatter.link("View full details on Osekai", medalURL)}`;

        if (value.length <= maxLength) {
            return value;
        }

        return TextFormatter.truncate(value, maxLength, `...${suffix}`);
    }
}
