import { Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractService } from "@/core/framework/AbstractService";
import { CommandOption } from "@domain/core/Command";
import { MatchedMapDto } from "@domain/osu/Beatmap.dto";
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
import { AdapterProvider } from "@generated/adapter/types";
import { OsuService } from "./Osu.service";
import { levenshtein } from "@domain/utils";

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

            if (/^\d+$/.test(val)) return { beatmapID: parseInt(val), beatmapsetID: null };

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
    ): Promise<MatchedMapDto> {
        const stored = await this.resolveCommandTarget(ctx, mapOption);

        let beatmapID = stored.beatmapID;
        let beatmapsetID = stored.beatmapsetID;

        if (!beatmapsetID && beatmapID) {
            const map = await this.osuService.beatmap(beatmapID, server);
            if (!map) throw new Exception(EApplicationError.NOT_FOUND, `Beatmap \`${beatmapID}\` was not found.`);
            beatmapsetID = map.beatmapsetID;
        }

        if (!beatmapsetID) {
            throw new Exception(EApplicationError.NOT_FOUND, "Could not determine beatmapset ID.");
        }

        if (versionOption?.some()) {
            const versionQuery = versionOption.unwrap().toLowerCase();
            const mapset = await this.osuService.beatmapset(beatmapsetID, server);
            if (!mapset || !mapset.beatmaps?.length) {
                throw new Exception(EApplicationError.NOT_FOUND, "Beatmapset not found or has no beatmaps.");
            }

            const substringMatches = mapset.beatmaps.filter(b => 
                b.version.toLowerCase().includes(versionQuery)
            );

            let matchedMap = mapset.beatmaps[0]!;
            let minDistance = Infinity;

            const pool = substringMatches.length > 0 ? substringMatches : mapset.beatmaps;

            for (const b of pool) {
                const mapVersion = b.version.toLowerCase();
                let distance = levenshtein(mapVersion, versionQuery);

                if (mapVersion.includes(versionQuery)) {
                    distance -= 0.5;
                }

                if (distance < minDistance) {
                    minDistance = distance;
                    matchedMap = b;
                }
            }

            beatmapID = matchedMap.id;
        } else if (!beatmapID) {
            const mapset = await this.osuService.beatmapset(beatmapsetID, server, true);
            if (!mapset || !mapset.beatmaps?.length) {
                throw new Exception(EApplicationError.NOT_FOUND, "Beatmapset not found or has no beatmaps.");
            }

            if (fallback === "highest") {
                mapset.beatmaps.sort((a, b) => b.difficulty - a.difficulty);
            } else {
                mapset.beatmaps.sort((a, b) => a.difficulty - b.difficulty);
            }

            beatmapID = mapset.beatmaps[0]!.id;
        }

        return { beatmapID, beatmapsetID };
    }
}
