import {
    discordEmoteModes,
    discordEmoteOfflineUrl,
    discordEmoteOnlineUrl,
    discordIconModes,
} from "@domain/discord/configs/Emotes.config";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { AdapterProvider, GameMode, Team } from "@generated/adapter/types";
import { ProviderMeta } from "@generated/adapter";

export class ProfileFormatter {
    public static status(online?: boolean): string | undefined {
        if (online) return discordEmoteOnlineUrl;
        return discordEmoteOfflineUrl;
    }

    public static rank(rank: number): string {
        return "#" + DiscordFormatter.number(rank);
    }

    public static countryRank(countryCode: string, rank: number, delimiter = "#"): string {
        return `${countryCode.toUpperCase()}${delimiter}${DiscordFormatter.number(rank)}`;
    }

    public static mode(mode: GameMode): string {
        switch (mode) {
            case GameMode.Standard:
                return "osu!";
            case GameMode.Taiko:
                return "osu!taiko";
            case GameMode.Catch:
                return "osu!catch";
            case GameMode.Mania:
                return "osu!mania";
        }
    }

    public static modeEmote(mode: GameMode): string {
        return discordEmoteModes[mode];
    }

    public static modeIcon(mode: GameMode): string {
        return discordIconModes[mode];
    }

    public static accuracy(acc: number): string {
        return `${DiscordFormatter.fixed(acc)}%`;
    }

    public static combo(combo: number): string {
        return `${DiscordFormatter.number(combo)}x`;
    }

    public static level(current: number, progress: number): string {
        return `${current}.${progress}`;
    }

    public static recommended(sr: number): string {
        return `${DiscordFormatter.fixed(sr)}★`;
    }

    public static playtime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        return `${hours} hr${hours !== 1 ? "s" : ""}`;
    }

    public static team(team?: Team): string {
        if (!team) return "";
        return team.shortName;
    }

    public static pp(pp?: number): string {
        if (!pp) return "0pp";
        return `${DiscordFormatter.number(pp)}pp`;
    }

    public static link(provider: AdapterProvider, userID: number, mode?: GameMode): string {
        return ProviderMeta[provider].formatters.userProfile(userID, mode);
    }

    public static avatar(provider: AdapterProvider, userID: number, timestamp?: number): string {
        return ProviderMeta[provider].formatters.userAvatar(userID, timestamp);
    }
}
