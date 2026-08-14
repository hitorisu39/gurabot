export interface IRankTarget {
    rank: number;
    countryCode?: string;
}

export class RankTargetParser {
    public static parse(input: string | number): IRankTarget | null {
        const value = String(input).trim().replace(/,/g, "");

        const global = value.match(/^#?([1-9]\d*)$/);

        if (global) {
            return {
                rank: Number(global[1]),
            };
        }

        const country = value.match(/^([a-z]{2})#?([1-9]\d*)$/i);
        if (country) {
            return {
                countryCode: country[1]!.toUpperCase(),
                rank: Number(country[2]),
            };
        }

        return null;
    }
}
