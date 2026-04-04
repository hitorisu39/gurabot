/**
 * Defines the horizontal alignment of text within a column.
 */
export type TableAlignment = "left" | "center" | "right";

export interface ColumnConfig<T> {
    /** The text to display in the header row. */
    header: string;
    /** The key of the object, or a function to extract/format the value. */
    accessor: keyof T | ((row: T) => string | number | null | undefined);
    /** Alignment of the data cells (defaults to "left"). */
    align?: TableAlignment;
    /** Alignment of the header cell (defaults to the column "align" or "left"). */
    headerAlign?: TableAlignment;
}

export interface TableBorders {
    vertical: string;
    horizontal: string;
    intersection: string;
    left: boolean;
    right: boolean;
    top: boolean;
    bottom: boolean;
    headerSeparator: boolean;
}

export interface TableConfig<T> {
    columns: Array<ColumnConfig<T>>;
    padding?: number;
    borders?: Partial<TableBorders>;
    hideHeader?: boolean;
}

export class AsciiTable<T> {
    private readonly columns: Array<ColumnConfig<T>>;
    private readonly padding: number;
    private readonly borders: TableBorders;
    private readonly hideHeader: boolean;

    constructor(config: TableConfig<T>) {
        if (!config.columns || config.columns.length === 0) {
            throw new Error("AsciiTable requires at least one column definition.");
        }

        this.columns = config.columns;
        this.padding = config.padding ?? 1;
        this.hideHeader = config.hideHeader ?? false;

        // Default border configuration
        this.borders = {
            vertical: "|",
            horizontal: "-",
            intersection: "+",
            left: true,
            right: true,
            top: true,
            bottom: true,
            headerSeparator: true,
            ...config.borders,
        };
    }

    /**
     * Generates the ASCII table string from the provided data.
     * @param data Array of records to render.
     * @returns Formatted ASCII table string.
     */
    public generate(data: ReadonlyArray<T>): string {
        const widths = this.calculateColumnWidths(data);
        const lines: Array<string> = [];

        // Top Border
        if (this.borders.top) {
            lines.push(this.renderSeparator(widths));
        }

        // Header Row
        if (!this.hideHeader) {
            const headers = this.columns.map((c) => c.header);
            const headerAligns = this.columns.map((c) => c.headerAlign ?? c.align ?? "left");
            lines.push(this.renderRow(headers, widths, headerAligns));

            // Header Separator
            if (this.borders.headerSeparator) {
                lines.push(this.renderSeparator(widths));
            }
        }

        // Data Rows
        for (const row of data) {
            const cells = this.columns.map((c) => this.extractValue(row, c.accessor));
            const aligns = this.columns.map((c) => c.align ?? "left");
            lines.push(this.renderRow(cells, widths, aligns));
        }

        // Bottom Border
        if (this.borders.bottom) {
            lines.push(this.renderSeparator(widths));
        }

        return lines.join("\n");
    }

    /**
     * Calculates the maximum required width for each column based on headers and data.
     */
    private calculateColumnWidths(data: ReadonlyArray<T>): Array<number> {
        return this.columns.map((col) => {
            let maxWidth = this.hideHeader ? 0 : col.header.length;
            for (const row of data) {
                const val = this.extractValue(row, col.accessor);
                if (val.length > maxWidth) {
                    maxWidth = val.length;
                }
            }
            return maxWidth;
        });
    }

    /**
     * Safely extracts and stringifies a value from a data row.
     */
    private extractValue(row: T, accessor: ColumnConfig<T>["accessor"]): string {
        let value: any;
        if (typeof accessor === "function") {
            value = accessor(row);
        } else {
            value = row[accessor];
        }
        return value === null || value === undefined ? "" : String(value);
    }

    /**
     * Aligns text within a specified width.
     */
    private alignText(text: string, width: number, align: TableAlignment): string {
        const diff = width - text.length;
        if (diff <= 0) return text;

        switch (align) {
            case "left":
                return text + " ".repeat(diff);
            case "right":
                return " ".repeat(diff) + text;
            case "center": {
                const leftPad = Math.floor(diff / 2);
                const rightPad = diff - leftPad;
                return " ".repeat(leftPad) + text + " ".repeat(rightPad);
            }
            default:
                return text;
        }
    }

    /**
     * Renders a single row of text data.
     */
    private renderRow(cells: string[], widths: number[], aligns: TableAlignment[]): string {
        const padStr = " ".repeat(this.padding);

        const renderedCells = cells.map((cell, i) => {
            const alignedText = this.alignText(cell, widths[i] ?? 0, aligns[i] ?? "center");
            return `${padStr}${alignedText}${padStr}`;
        });

        const inner = renderedCells.join(this.borders.vertical);
        const left = this.borders.left ? this.borders.vertical : "";
        const right = this.borders.right ? this.borders.vertical : "";

        return `${left}${inner}${right}`.trimEnd();
    }

    /**
     * Renders a horizontal separator line (e.g., between headers and data).
     */
    private renderSeparator(widths: number[]): string {
        const renderedSegments = widths.map((w) => this.borders.horizontal.repeat(w + this.padding * 2));

        const inner = renderedSegments.join(this.borders.intersection);
        const left = this.borders.left ? this.borders.intersection : "";
        const right = this.borders.right ? this.borders.intersection : "";

        return `${left}${inner}${right}`;
    }
}
