import { discordEmoteGrades, discordEmoteMiss } from "@domain/discord/configs/Emotes.config";
import { ParsedMod } from "@generated/adapter/mods";
import { GameMode, Grade, ScoreStatistics } from "@generated/adapter/types";

export class ScoreFormatter {
    public static grade(grade: Grade, scoreID?: number): string {
        const emote = discordEmoteGrades[grade] ?? grade;
        if (scoreID) return `[${emote}](https://osu.ppy.sh/scores/${scoreID})`;

        return emote;
    }

    public static pp(pp: number = 0, ppfc?: number): string {
        const formattedPP = pp.toFixed(2);

        if (ppfc && pp !== ppfc) {
            return `**${formattedPP}**/${Math.round(ppfc)}pp`;
        }

        return `**${formattedPP}**pp`;
    }

    public static combo(combo: number = 0, max?: number, bolded: boolean = false): string {
        const comboStr = bolded ? `**${combo}x**` : `${combo}x`;

        if (max && combo !== max) {
            return `${comboStr}/${max}`;
        }
        return comboStr;
    }

    public static miss(count?: number): string {
        if (count && count > 0) {
            return `${count}${discordEmoteMiss}`;
        }
        return "";
    }

    public static mods(mods: Array<ParsedMod>): string {
        if (!mods || mods.length === 0) return "";
        return `+${mods.map((m) => m.acronym).join("")}`;
    }

    public static accuracy(acc: number): string {
        return `${(acc * 100).toFixed(2)}%`;
    }

    public static statistics(statistics: ScoreStatistics, mode: GameMode, delimiter: string = "/"): string {
        const stats =
            mode === GameMode.Mania
                ? [
                      statistics.perfect,
                      statistics.great,
                      statistics.good,
                      statistics.ok,
                      statistics.meh,
                      statistics.miss,
                  ]
                : [statistics.great, statistics.ok, statistics.meh, statistics.miss].join(delimiter);

        return `[${stats}]`;
    }

    public static header(artist: string, title: string, version: string, limit: number = 65): string {
        const fullOption = `${artist} - ${title} [${version}]`;
        if (fullOption.length <= limit) return fullOption;

        const noArtistOption = `${title} [${version}]`;
        if (noArtistOption.length <= limit) return noArtistOption;

        const availableChars = limit - 3;
        if (availableChars <= 0) return "";

        let finalTitle = title;
        let finalVersion = version;

        if (finalTitle.length + finalVersion.length > availableChars) {
            const halfLimit = Math.floor(availableChars / 2);

            if (finalTitle.length <= halfLimit) {
                const remainingSpace = availableChars - finalTitle.length;
                finalVersion = finalVersion.slice(0, Math.max(0, remainingSpace - 2)).trim() + "..";
            } else if (finalVersion.length <= halfLimit) {
                const remainingSpace = availableChars - finalVersion.length;
                finalTitle = finalTitle.slice(0, Math.max(0, remainingSpace - 2)).trim() + "..";
            } else {
                finalTitle = finalTitle.slice(0, halfLimit - 2).trim() + "..";
                finalVersion = finalVersion.slice(0, availableChars - finalTitle.length - 2).trim() + "..";
            }
        }

        return `${finalTitle} [${finalVersion}]`;
    }
}
