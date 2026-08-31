import { GameMode, Status, User } from "@generated/adapter/types";
import { PopulatedScore } from "../Score.dto";
import { ScoreFormatter } from "./Score.formatter";
import { isValidNumber } from "@domain/utils/utils";
import { EPersonalBestCase } from "../enums/Score.enum";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { ScoreUtils } from "../utils/ScoreUtils";
import { ProfileFormatter } from "./Profile.formatter";

export class ScorepostFormatter {
    /**
     * The style is probably too specific to put in Date formatter.
     */
    public static dateLazer(date: Date, timezoneOffsetMinutes = 0): string {
        const months = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ];

        const shifted = new Date(date.getTime() + timezoneOffsetMinutes * 60_000);
        const day = shifted.getUTCDate();
        const month = months[shifted.getUTCMonth()];
        const year = shifted.getUTCFullYear();
        const hours = String(shifted.getUTCHours()).padStart(2, "0");
        const minutes = String(shifted.getUTCMinutes()).padStart(2, "0");

        return `Played on ${day} ${month} ${year} ` + `${hours}:${minutes}`;
    }

    public static dateStable(date: Date, timezoneOffsetMinutes = 0): string {
        const shifted = new Date(date.getTime() + timezoneOffsetMinutes * 60_000);
        const year = shifted.getUTCFullYear();
        const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
        const day = String(shifted.getUTCDate()).padStart(2, "0");
        const hours = shifted.getUTCHours();
        const minutes = String(shifted.getUTCMinutes()).padStart(2, "0");
        const seconds = String(shifted.getUTCSeconds()).padStart(2, "0");
        return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}.`;
    }

    public static text(user: User, score: PopulatedScore, text?: string | null): string {
        const beatmap = score.beatmap;
        const mapset = score.beatmapset;
        const stars = score.fullDifficulty.starRating;
        const mods = ScoreFormatter.mods(score.mods.filter((m) => m.acronym !== "CL"));

        const mode = score.mode && score.mode !== GameMode.Standard ? `[${ProfileFormatter.mode(score.mode)}]` : "";
        const accuracy = score.accuracy === 1 ? "" : `${Number(score.accuracy * 100).toFixed(2)}%`;

        const globalTop = isValidNumber(score.globalTop) ? `#${score.globalTop + 1}` : "";
        const presentInTop =
            score.personalBest &&
            (score.personalBest.case === EPersonalBestCase.ScorePresent ||
                score.personalBest.case === EPersonalBestCase.ScorePresentPresumably);
        const personalBest = presentInTop && score.personalBest?.index === 0 ? "Their new top play!" : "";

        let fullCombo = score.accuracy === 1 ? "SS" : "FC";
        if (!ScoreUtils.isFC(score) && score.calculatedFC) {
            const miss = score.statistics.miss > 0 ? `${score.statistics.miss}xMiss` : "S Rank";
            fullCombo = `${score.maxCombo}/${score.fullDifficulty.maxCombo} ` + miss;
        }

        const pp = `${DiscordFormatter.fixed(score.pp ?? score.calculated.attributes.total, 0)}pp`;
        const ppFC =
            !ScoreUtils.isFC(score) && score.calculatedFC
                ? `(${DiscordFormatter.fixed(score.calculatedFC.attributes.total, 0)}pp if FC)`
                : "";

        const ranked = ScoreUtils.isRanked(score) ? "" : "if ranked";
        const loved = beatmap.status === Status.Loved ? "💖" : "";

        const trailingText = text ? text.trim() : personalBest;
        const trailing = trailingText.length > 0 ? `| ${trailingText}` : "";

        const line = [
            mode,
            user.username,
            "|",
            `${mapset.artist} - ${mapset.title}`,
            `[${beatmap.version}]`,
            `(${mapset.creator}, ${stars.toFixed(2)}*)`,
            mods,
            accuracy,
            fullCombo,
            globalTop,
            loved,
            "|",
            pp,
            ranked,
            ppFC,
            trailing,
        ];

        return line
            .filter((v) => v.length > 0)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
    }
}
