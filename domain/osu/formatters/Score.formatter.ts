import { discordEmoteGrades, discordEmoteMiss } from "@domain/discord/configs/Emotes.config";
import { ParsedMod } from "@generated/adapter/mods";
import { Beatmap, GameMode, Grade, Score, ScoreStatistics } from "@generated/adapter/types";
import { osuBaseDomain } from "../configs/Osu.config";
import { PersonalBestPlacementDto, ScoreWithPlacement } from "../Score.dto";
import { EPersonalBestCase } from "../enums/Score.enum";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";

export class ScoreFormatter {
    public static completion(statistics: ScoreStatistics, beatmap: Beatmap, mode: GameMode): number | null {
        if (mode === GameMode.Catch) return null;

        const hits =
            (statistics.perfect ?? 0) +
            (statistics.great ?? 0) +
            (statistics.good ?? 0) +
            (statistics.ok ?? 0) +
            (statistics.meh ?? 0) +
            (statistics.miss ?? 0);

        const totalObjects = beatmap.countCircles + beatmap.countSliders + beatmap.countSpinners;
        if (totalObjects === 0) return null;
        return (hits / totalObjects) * 100;
    }

    public static grade(grade: Grade, passed: boolean, scoreID?: number | null, completion?: number | null): string {
        if (!passed) {
            const emote = discordEmoteGrades[Grade.F] ?? "F";
            return completion ? `${emote} @${Math.round(completion)}%` : emote;
        }

        const emote = discordEmoteGrades[grade] ?? grade;
        if (scoreID) return `[${emote}](https://${osuBaseDomain}/scores/${scoreID})`;

        return emote;
    }

    public static pp(
        pp: number = 0,
        ppfc?: number,
        bold: boolean = true,
    ): string {
        const formattedPP = pp.toFixed(2);
        const displayedPP = bold ? `**${formattedPP}**` : formattedPP;

        if (ppfc && pp !== ppfc) {
            return `${displayedPP}/${Math.round(ppfc)}pp`;
        }

        return `${displayedPP}pp`;
    }

    public static combo(combo: number = 0, max?: number, bolded: boolean = false): string {
        const comboStr = bolded ? `**${combo}x**` : `${combo}x`;

        if (max && combo !== max) {
            return `${comboStr}/${max}`;
        }
        return comboStr;
    }

    public static miss(count?: number, zero?: boolean): string {
        if ((count && count > 0) || zero) {
            return `${count}${discordEmoteMiss}`;
        }
        return "";
    }

    public static mods(mods: Array<ParsedMod>): string {
        if (!mods.length) return "";
        return `+${mods.map((mod) => this.mod(mod)).join("")}`;
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
                : [statistics.great, statistics.ok, statistics.meh, statistics.miss];

        return `[${stats.join(delimiter)}]`;
    }

    public static placement(score: Score, compact: boolean = false): string {
        const placedScore = score as ScoreWithPlacement;

        const personal = placedScore.personalBest
            ? this.personalPlacement(score, placedScore.personalBest, compact)
            : "";

        const global =
            placedScore.globalTop !== undefined
                ? compact
                    ? `GT#${placedScore.globalTop + 1}`
                    : `Global Top #${placedScore.globalTop + 1}`
                : "";

        const parts = [personal, global].filter(Boolean);

        if (!parts.length) {
            return "";
        }

        const text = parts.join(" and ");

        return compact ? `**${text}**` : `__**${text}**__`;
    }

    private static personalPlacement(score: Score, personal: PersonalBestPlacementDto, compact: boolean): string {
        const placement = compact ? `PB#${personal.index + 1}` : `Personal Best #${personal.index + 1}`;

        switch (personal.case) {
            case EPersonalBestCase.ScorePresent:
                return placement;
            case EPersonalBestCase.ScorePresentPresumably: {
                const hasBeenProcessingForMinute = Date.now() - score.endedAt.getTime() >= 60 * 1000;

                return hasBeenProcessingForMinute ? `${placement} (processing)` : placement;
            }
            case EPersonalBestCase.NotRanked:
                return `${placement} (if ranked)`;
            default:
                return "";
        }
    }

    private static mod(mod: ParsedMod): string {
        switch (mod.acronym) {
            case "DT":
            case "NC":
            case "HT":
            case "DC":
                if (!mod.settings?.speed_change) return mod.acronym;

                return `${mod.acronym}(${DiscordFormatter.fixed(mod.settings.speed_change)}x)`;
            default:
                return mod.acronym;
        }
    }
}
