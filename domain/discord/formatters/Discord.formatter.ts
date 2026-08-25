import { discordSpaceUnicode } from "../configs/Discord.config";
import { TextFormatter } from "./Text.formatter";

export class DiscordFormatter {
    public static number(num?: number | string): string {
        if (!num) return "0";
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    public static fixed(num?: number, decimals: number = 2, round: boolean = true): number {
        if (!num || isNaN(num)) return 0;
        const factor = Math.pow(10, decimals);
        return round ? Math.round(num * factor) / factor : Math.trunc(num * factor) / factor;
    }

    public static countryFlag(domain: string, countryCode: string, extension: string = "png"): string {
        const fileName = countryCode
            .toUpperCase()
            .split("")
            .map((c) => (c.charCodeAt(0) + 127397).toString(16))
            .join("-");

        return `${domain}/${fileName}.${extension}`;
    }

    public static countryEmoji(countryCode: string): string {
        const code = countryCode.trim().toUpperCase();

        if (!/^[A-Z]{2}$/.test(code)) {
            return "🏳️";
        }

        return String.fromCodePoint(...[...code].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65));
    }

    public static link(label: string | number, url: string, name?: string | number | null, backtick?: boolean): string {
        const formattedLabel = backtick ? `\`${label}\`` : label;
        if (name) return `[${formattedLabel}](${url} "${name}")`;

        return `[${formattedLabel}](${url})`;
    }

    public static space(repeat: number): string {
        return discordSpaceUnicode.repeat(repeat);
    }

    public static plural(count: number, singular: string, plural: string = `${singular}s`) {
        return count === 1 ? singular : plural;
    }

    public static quantity(count: number, singular: string, plural: string = `${singular}s`): string {
        return `${this.number(count)} ${this.plural(count, singular, plural)}`;
    }

    public static smallNumber(value: number): string {
        const superscriptMap: Record<string, string> = {
            "0": "⁰",
            "1": "¹",
            "2": "²",
            "3": "³",
            "4": "⁴",
            "5": "⁵",
            "6": "⁶",
            "7": "⁷",
            "8": "⁸",
            "9": "⁹",
        };

        return value
            .toString()
            .split("")
            .map((d) => superscriptMap[d] || d)
            .join("");
    }

    public static smallArrow(direction: "up" | "down"): string {
        const arrowMap = {
            up: "ꜛ",
            down: "ꜜ",
        };

        return arrowMap[direction];
    }

    public static delta(value: number): string {
        const prefix = value > 0 ? "+" : "";
        return `${prefix}${DiscordFormatter.number(value)}`;
    }

    public static bytes(bytes: number): string {
        if (bytes < 1_024) return `${bytes} B`;
        if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
        return `${(bytes / (1_024 * 1_024)).toFixed(1)} MB`;
    }

    public static formatInlineGrid(
        items: Array<{
            label: string;
            value: string;
            prefix?: string;
        }>,
        preferredCols = 3,
        widthLimit = 64,
        join = " > ",
        labelLimit = 17,
        valueLimit = 12,
        order: "row" | "column" = "row",
    ): string {
        if (items.length === 0) return "*None*";

        const processedItems = items.map((item) => ({
            label: TextFormatter.truncate(item.label, labelLimit),
            value: TextFormatter.truncate(item.value, valueLimit),
            prefix: item.prefix ?? "",
        }));

        const maxLabelLen = Math.max(...processedItems.map((item) => item.label.length));
        const maxValLen = Math.max(...processedItems.map((item) => item.value.length));

        const maxPrefixLen = Math.max(...processedItems.map((item) => item.prefix.length));

        const cellWidth = maxPrefixLen + maxLabelLen + maxValLen + 1;
        const separatorWidth = join.length;

        let cols = preferredCols;

        while (cols > 1) {
            const estimatedWidth = cellWidth * cols + separatorWidth * (cols - 1);

            if (estimatedWidth <= widthLimit) {
                break;
            }

            cols--;
        }

        const cells = processedItems.slice(0, 21).map((item) => {
            const paddedLabel = item.label.padEnd(maxLabelLen, " ");
            const paddedVal = item.value.padStart(maxValLen, " ");
            return `${item.prefix}\`${paddedLabel} ${paddedVal}\``;
        });

        const rows: Array<string> = [];

        if (order === "column" && cols > 1) {
            const rowCount = Math.ceil(cells.length / cols);

            for (let row = 0; row < rowCount; row++) {
                const rowCells: Array<string> = [];

                for (let col = 0; col < cols; col++) {
                    const index = row + col * rowCount;
                    const cell = cells[index];

                    if (cell) {
                        rowCells.push(cell);
                    }
                }

                rows.push(rowCells.join(join));
            }
        } else {
            for (let i = 0; i < cells.length; i += cols) {
                rows.push(cells.slice(i, i + cols).join(join));
            }
        }

        return rows.join("\n");
    }
}
