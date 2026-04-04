export class DescriptionBuilder {
    private lines: Array<string> = [];

    public add(line: string): this {
        this.lines.push(line);
        return this;
    }

    public addIf(condition: unknown, line: string | (() => string)): this {
        if (condition) this.lines.push(typeof line === "function" ? line() : line);

        return this;
    }

    public build(): string {
        return this.lines.join("\n");
    }

    public buildOr(line: string): string {
        if (!this.lines.length) return line;

        return this.build();
    }
}
