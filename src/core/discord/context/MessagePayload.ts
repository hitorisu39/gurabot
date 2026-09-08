import { BaseMessageOptionsWithPoll, EmbedBuilder, InteractionReplyOptions } from "discord.js";

/**
 * Message data supported by both regular Discord messages and interaction responses.
 */
export interface IMessageOptions extends BaseMessageOptionsWithPoll {
    /**
     * Supported by both regular message sends and interaction replies.
     */
    tts?: InteractionReplyOptions["tts"];
}

/**
 * Behaviour specific to an interaction response.
 */
export interface IResponseOptions extends IMessageOptions {
    ephemeral?: boolean;
}

export type TMessagePayload = string | EmbedBuilder | IResponseOptions;

/**
 * One file entry accepted by our message payload.
 */
export type TMessageFile = NonNullable<IMessageOptions["files"]>[number];

/**
 * The full files array shape.
 */
export type TMessageFiles = NonNullable<IMessageOptions["files"]>;
