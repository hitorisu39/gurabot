export class TextFormatter {
    public static htmlToMarkdown(value: string | null | undefined): string | null {
        if (!value?.trim()) {
            return null;
        }

        return (
            value
                // Structural tags
                .replace(/<br\s*\/?>/gi, "\n")
                .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
                .replace(/<\/?p[^>]*>/gi, "")

                // Links
                .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis, "[$2]($1)")

                // Formatting
                .replace(/<(?:b|strong)>(.*?)<\/(?:b|strong)>/gis, "**$1**")
                .replace(/<(?:i|em)>(.*?)<\/(?:i|em)>/gis, "*$1*")
                .replace(/<u>(.*?)<\/u>/gis, "__$1__")
                .replace(/<s>(.*?)<\/s>/gis, "~~$1~~")
                .replace(/<code>(.*?)<\/code>/gis, "`$1`")

                // Strip anything unsupported
                .replace(/<[^>]+>/g, "")

                // HTML entities
                .replace(/&nbsp;/gi, " ")
                .replace(/&amp;/gi, "&")
                .replace(/&lt;/gi, "<")
                .replace(/&gt;/gi, ">")
                .replace(/&quot;/gi, '"')
                .replace(/&#39;/gi, "'")

                // Cleanup
                .replace(/[ \t]+\n/g, "\n")
                .replace(/\n{3,}/g, "\n\n")
                .trim()
        );
    }

    public static escapeMarkdown(value: string): string {
        return value.replace(/([\\`*_~|[\]()>])/g, "\\$1");
    }

    public static inlineCode(value: string): string {
        const escaped = value.replace(/\\/g, "\\\\").replace(/`/g, "ˋ").replace(/\r?\n/g, " ");

        return `\`${escaped}\``;
    }

    public static truncate(value: string, maxLength: number, suffix: string = "..."): string {
        if (value.length <= maxLength) {
            return value;
        }

        const available = Math.max(0, maxLength - suffix.length);
        return `${value.slice(0, available).trimEnd()}${suffix}`;
    }

    public static escapeRegExp(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    public static joinClauses(clauses: ReadonlyArray<string>): string {
        if (clauses.length <= 1) {
            return clauses[0] ?? "";
        }

        if (clauses.length === 2) {
            return `${clauses[0]} and ${clauses[1]}`;
        }

        return `${clauses.slice(0, -1).join(", ")}, and ${clauses.at(-1)}`;
    }

    public static possessive(value: string, backticks: boolean = false): string {
        const formatted = backticks ? `\`${value}\`` : value;
        return /s$/i.test(value) ? `${formatted}'` : `${formatted}'s`;
    }
}
