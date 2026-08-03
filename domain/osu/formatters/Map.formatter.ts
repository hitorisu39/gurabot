import { discordEmoteDifficulty, modeEmoteKeys } from "@domain/discord/configs/Emotes.config";
import { GameMode } from "@generated/adapter/types";
import { osuBaseUrl } from "../configs/Osu.config";

export class MapFormatter {
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
                finalVersion = `${finalVersion.slice(0, Math.max(0, remainingSpace - 2)).trim()}..`;
            } else if (finalVersion.length <= halfLimit) {
                const remainingSpace = availableChars - finalVersion.length;
                finalTitle = `${finalTitle.slice(0, Math.max(0, remainingSpace - 2)).trim()}..`;
            } else {
                finalTitle = `${finalTitle.slice(0, Math.max(0, halfLimit - 2)).trim()}..`;

                const versionLimit = availableChars - finalTitle.length - 2;
                finalVersion = `${finalVersion.slice(0, Math.max(0, versionLimit)).trim()}..`;
            }
        }

        return `${finalTitle} [${finalVersion}]`;
    }

    public static difficultyEmote(mode: GameMode, stars: number): string {
        const modeKey = modeEmoteKeys[mode] ?? "std";
        let level = 0;

        if (stars >= 8) {
            level = 9;
        } else if (stars >= 7) {
            level = 8;
        } else if (stars >= 1.75) {
            level = Math.ceil((stars - 1.74999) / 0.75);
        }

        const key = `${modeKey}_${level}`;
        return discordEmoteDifficulty[key] ?? "";
    }

    public static background(mapsetID: number): string {
        return `https://catboy.best/preview/background/${mapsetID}/set`;
    }

    public static previewGameplay(mapID: number): string {
        return `https://jmir.xyz/osu/preview.html#${mapID}`;
    }

    public static previewGameplayMirror(mapID: number): string {
        return `https://osu.pages.dev/preview#${mapID}`;
    }

    public static stars(stars: number = 0): string {
        const floored = Math.floor(stars * 100) / 100;
        return `${floored.toFixed(2)}★`;
    }

    public static length(length: number): string {
        const totalSeconds = Math.floor(length);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const pad = (num: number) => num.toString().padStart(2, "0");

        return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
    }

    public static link(mapID: number): string {
        return `${osuBaseUrl}/b/${mapID}`;
    }
}
