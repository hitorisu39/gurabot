import { discordSpaceUnicode } from "../configs/Discord.config";

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

    public static link(label: string | number, url: string, name?: string | number, backtick?: boolean): string {
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

    public static formatInlineGrid(
        items: Array<{ label: string; value: string }>,
        preferredCols = 3,
        widthLimit = 64,
        join = " > ",
    ): string {
        if (items.length === 0) return "*None*";

        const truncate = (str: string, max: number) => (str.length > max ? str.slice(0, max - 1) + "…" : str);

        const processedItems = items.map((i) => ({
            label: truncate(i.label, 17),
            value: truncate(i.value, 12),
        }));

        const maxLabelLen = Math.max(...processedItems.map((i) => i.label.length));
        const maxValLen = Math.max(...processedItems.map((i) => i.value.length));

        const cellWidth = maxLabelLen + maxValLen + 3;
        const separatorWidth = 3;

        let cols = preferredCols;
        while (cols > 1) {
            const estimatedWidth = cellWidth * cols + separatorWidth * (cols - 1);
            if (estimatedWidth <= widthLimit) {
                break;
            }
            cols--;
        }

        const cells = processedItems.map((item) => {
            const paddedLabel = item.label.padEnd(maxLabelLen, " ");
            const paddedVal = item.value.padStart(maxValLen, " ");
            return `\`${paddedLabel} ${paddedVal}\``;
        });

        const limitedCells = cells.slice(0, 21);
        const rows: Array<string> = [];

        for (let i = 0; i < limitedCells.length; i += cols) {
            rows.push(limitedCells.slice(i, i + cols).join(join));
        }

        return rows.join("\n");
    }
}
