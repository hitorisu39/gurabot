import {
    APIInteractionGuildMember,
    EmbedBuilder,
    Guild,
    GuildMember,
    InteractionResponse,
    Message,
    TextBasedChannel,
    User,
} from "discord.js";
import { IMessageOptions, TMessagePayload } from "./CommandContext";

export abstract class InteractionContext {
    public isDeferred = false;

    public abstract readonly author: User;
    public abstract readonly guild: Guild | null;
    public abstract readonly channel: TextBasedChannel | null;
    public abstract readonly member: GuildMember | APIInteractionGuildMember | null;

    /**
     * Send this interaction's primary response.
     * For commands this is the command response.
     * For components this is a new response, not an update to the source message.
     */
    public abstract respond(options: TMessagePayload): Promise<Message | InteractionResponse | null>;

    protected normalizePayload(options: TMessagePayload): IMessageOptions {
        if (typeof options === "string") {
            return { content: options };
        }

        if (options instanceof EmbedBuilder) {
            return { embeds: [options] };
        }

        return options;
    }
}
