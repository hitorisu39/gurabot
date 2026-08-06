import { Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractService } from "@/core/framework/AbstractService";
import { CommandOption } from "@domain/core/Command";
import { MatchedMapDto, ResolvedBeatmapDto } from "@domain/osu/Beatmap.dto";
import {
    beatmapDefaultRegex,
    beatmapLongRegex,
    beatmapShortRegex,
    mapsetDefaultRegex,
    mapsetShortRegex,
} from "@domain/osu/configs/Beatmap.config";
import { osuBaseDomain } from "@domain/osu/configs/Osu.config";
import { EBeatmapMatch } from "@domain/osu/enums/Beatmap.enum";
import { Message, RESTJSONErrorCodes } from "discord.js";
import { ChannelService } from "../channel/Channel.service";
import { MessageContext } from "@/core/discord/context/MessageContext";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { AdapterProvider, Beatmap } from "@generated/adapter/types";
import { OsuService } from "./Osu.service";
import { levenshtein } from "@domain/utils";
import { discordRegexAnyNumber } from "@domain/discord/configs/Discord.config";

export class BeatmapResolverService extends AbstractService {
    @Import() declare private readonly channelService: ChannelService;
    @Import() declare private readonly osuService: OsuService;

    private readonly matches = [
        { type: EBeatmapMatch.Long, regex: beatmapLongRegex },
        { type: EBeatmapMatch.Default, regex: beatmapDefaultRegex },
        { type: EBeatmapMatch.Short, regex: beatmapShortRegex },
        { type: EBeatmapMatch.Mapset, regex: mapsetDefaultRegex },
        { type: EBeatmapMatch.MapsetShort, regex: mapsetShortRegex },
    ];

    public fromText(text: string): MatchedMapDto | null {
        if (!text || !text.includes(osuBaseDomain)) return null;

        for (const { type, regex } of this.matches) {
            const match = text.match(regex);
            if (!match) continue;

            switch (type) {
                case EBeatmapMatch.Long:
                    return { beatmapsetID: Number(match[1]), beatmapID: Number(match[2]) };
                case EBeatmapMatch.Default:
                case EBeatmapMatch.Short:
                    return { beatmapID: Number(match[1]), beatmapsetID: null };
                case EBeatmapMatch.Mapset:
                case EBeatmapMatch.MapsetShort:
                    return { beatmapID: null, beatmapsetID: Number(match[1]) };
            }
        }
        return null;
    }

    public fromMessage(message: Message): MatchedMapDto | null {
        let matched = this.fromText(message.content);
        if (matched) return matched;

        if (message.embeds.length > 0) {
            for (const embed of message.embeds) {
                const embedString = [
                    embed.url,
                    embed.author?.url,
                    embed.description,
                    embed.title,
                    embed.footer?.text,
                    ...(embed.fields?.map((f) => f.value) || []),
                ].join(" ");

                if (!embedString.includes(osuBaseDomain)) continue;

                matched = this.fromText(embedString);
                if (matched) return matched;
            }
        }
        return null;
    }

    public async resolveCommandTarget(ctx: CommandContext, mapOption?: CommandOption<string>): Promise<MatchedMapDto> {
        if (mapOption?.some()) {
            const val = mapOption.unwrap();

            if (discordRegexAnyNumber.test(val)) return { beatmapID: parseInt(val), beatmapsetID: null };

            const extracted = this.fromText(val);
            if (extracted) return extracted;

            throw new Exception(EApplicationError.INPUT_ERROR, "Invalid map ID or URL provided.");
        }

        if (ctx instanceof MessageContext && ctx.message.reference?.messageId) {
            try {
                const replied = await ctx.message.channel.messages.fetch(ctx.message.reference.messageId);
                const matched = this.fromMessage(replied);
                if (matched) return matched;
            } catch (error: any) {
                if (error?.code !== RESTJSONErrorCodes.UnknownMessage) this.logger.debug(error);
            }
        }

        if (ctx.channel) {
            const stored = await this.channelService.getBeatmap(ctx.channel.id);
            if (stored) return stored;
        }

        throw new Exception(
            EApplicationError.INPUT_ERROR,
            "No any beatmap(set) url / id was specified and none stored in the channel.\n" +
                "Tip: try using commands which contain scores (such as `rs` or `top`).",
        );
    }

    public async resolveTargetWithVersion(
        ctx: CommandContext,
        mapOption?: CommandOption<string>,
        versionOption?: CommandOption<string>,
        server: AdapterProvider = AdapterProvider.Bancho,
        fallback: "lowest" | "highest" = "highest",
    ): Promise<ResolvedBeatmapDto> {
        const stored = await this.resolveCommandTarget(ctx, mapOption);

        let beatmapID = stored.beatmapID;
        let beatmapsetID = stored.beatmapsetID;
        let beatmap: Beatmap | null = null;

        if (!beatmapsetID && beatmapID) {
            beatmap = await this.osuService.beatmap(beatmapID, server);

            if (!beatmap) {
                throw new Exception(EApplicationError.NOT_FOUND, `Beatmap \`${beatmapID}\` was not found.`);
            }

            beatmapsetID = beatmap.beatmapsetID;
        }

        if (!beatmapsetID) {
            throw new Exception(EApplicationError.NOT_FOUND, "Could not determine beatmapset ID.");
        }

        if (versionOption?.some()) {
            const versionQuery = versionOption.unwrap().toLowerCase();

            const mapset = await this.osuService.beatmapset(beatmapsetID, server);

            if (!mapset?.beatmaps?.length) {
                throw new Exception(EApplicationError.NOT_FOUND, "Beatmapset not found or has no beatmaps.");
            }

            const substringMatches = mapset.beatmaps.filter((candidate) =>
                candidate.version.toLowerCase().includes(versionQuery),
            );

            const pool = substringMatches.length > 0 ? substringMatches : mapset.beatmaps;

            let matchedMap = pool[0]!;
            let minDistance = Number.POSITIVE_INFINITY;

            for (const candidate of pool) {
                const candidateVersion = candidate.version.toLowerCase();

                let distance = levenshtein(candidateVersion, versionQuery);

                if (candidateVersion.includes(versionQuery)) {
                    distance -= 0.5;
                }

                if (distance < minDistance) {
                    minDistance = distance;
                    matchedMap = candidate;
                }
            }

            beatmap = matchedMap;
            beatmapID = matchedMap.id;
            beatmapsetID = matchedMap.beatmapsetID ?? beatmapsetID;
        } else if (!beatmapID) {
            const mapset = await this.osuService.beatmapset(beatmapsetID, server, true);

            if (!mapset?.beatmaps?.length) {
                throw new Exception(EApplicationError.NOT_FOUND, "Beatmapset not found or has no beatmaps.");
            }

            const orderedMaps = [...mapset.beatmaps].sort((a, b) =>
                fallback === "highest" ? b.difficulty - a.difficulty : a.difficulty - b.difficulty,
            );

            beatmap = orderedMaps[0]!;
            beatmapID = beatmap.id;
            beatmapsetID = beatmap.beatmapsetID ?? beatmapsetID;
        }

        if (!beatmap && beatmapID) {
            beatmap = await this.osuService.beatmap(beatmapID, server);
        }

        if (!beatmap) {
            throw new Exception(EApplicationError.NOT_FOUND, "Could not resolve beatmap.");
        }

        return {
            beatmapID: beatmap.id,
            beatmapsetID: beatmap.beatmapsetID ?? beatmapsetID,
            beatmap,
        };
    }
}
