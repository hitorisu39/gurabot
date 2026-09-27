import { CommandContext } from "@/core/discord/context/CommandContext";
import { MessageContext } from "@/core/discord/context/MessageContext";
import { AbstractService } from "@/core/framework/AbstractService";
import { CommandOption } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { osuBaseAssetsDomain } from "@domain/osu/configs/Osu.config";
import { scoreUrlRegex, scoreUrlSearchRegex } from "@domain/osu/configs/Score.config";
import { Message, RESTJSONErrorCodes } from "discord.js";
import { Import } from "@/core/decorators";
import { ChannelService } from "@/modules/channel/Channel.service";

export class ScoreResolverService extends AbstractService {
    @Import() declare private readonly channelService: ChannelService;

    public fromText(text: string): string | null {
        if (!text) {
            return null;
        }

        const match = text.match(scoreUrlSearchRegex);
        if (!match?.[1]) {
            return null;
        }

        return this.normalize(match[1]);
    }

    public fromMessage(message: Message): string | null {
        const content = this.fromText(message.content);

        if (content) {
            return content;
        }

        for (const embed of message.embeds) {
            if (embed.thumbnail?.url) {
                const thumbnailScore = this.fromThumbnail(embed.thumbnail.url);
                if (thumbnailScore) {
                    return thumbnailScore;
                }
            }

            const embedString = [
                embed.url,
                embed.author?.url,
                embed.description,
                embed.title,
                embed.footer?.text,
                ...(embed.fields?.map((field) => field.value) ?? []),
            ]
                .filter(Boolean)
                .join(" ");

            const matched = this.fromText(embedString);

            if (matched) {
                return matched;
            }
        }

        return null;
    }

    public async resolveCommandTarget(ctx: CommandContext, scoreOption?: CommandOption<string>): Promise<string> {
        if (scoreOption?.some()) {
            const value = scoreOption.unwrap().trim();

            if (/^[0-9]+$/.test(value)) {
                return this.normalize(value);
            }

            const match = value.match(scoreUrlRegex);
            if (match?.[1]) {
                return this.normalize(match[1]);
            }

            throw new Exception(EApplicationError.INPUT_ERROR, "Invalid score ID or URL provided.");
        }

        if (ctx instanceof MessageContext && ctx.message.reference?.messageId) {
            try {
                const replied = await ctx.message.channel.messages.fetch(ctx.message.reference.messageId);
                const matched = this.fromMessage(replied);
                if (matched) {
                    return matched;
                }
            } catch (error: any) {
                if (error?.code !== RESTJSONErrorCodes.UnknownMessage) {
                    this.logger.debug(error);
                }
            }
        }

        if (ctx.channel) {
            const storedScoreID = await this.channelService.getScore(ctx.channel.id);

            if (storedScoreID) {
                return this.normalize(storedScoreID);
            }
        }

        throw new Exception(
            EApplicationError.INPUT_ERROR,
            "No score URL or ID was specified and none is stored in this channel.\n" +
                "Tip: use some score command or reply to a message containing an osu! score URL.",
        );
    }

    private fromThumbnail(url: string): string | null {
        try {
            const parsed = new URL(url);
            if (parsed.hostname !== osuBaseAssetsDomain) {
                return null;
            }

            if (!/^\/beatmaps\/[0-9]+\/covers\//.test(parsed.pathname)) {
                return null;
            }

            const scoreID = parsed.searchParams.get("score_id");
            if (!scoreID || !/^[0-9]+$/.test(scoreID)) {
                return null;
            }

            return this.normalize(scoreID);
        } catch {
            return null;
        }
    }

    private normalize(id: string): string {
        try {
            return BigInt(id).toString();
        } catch {
            throw new Exception(EApplicationError.INPUT_ERROR, "Invalid score ID.");
        }
    }
}
