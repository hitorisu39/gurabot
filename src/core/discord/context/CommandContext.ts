import {
    ActionRowBuilder,
    APIInteractionGuildMember,
    AttachmentBuilder,
    AttachmentPayload,
    BufferResolvable,
    EmbedBuilder,
    Guild,
    GuildMember,
    InteractionResponse,
    Message,
    MessageActionRowComponentBuilder,
    TextBasedChannel,
    User,
} from "discord.js";
import { ICommandState } from "@domain/core/Command";
import { ICommandMetadata } from "@/core/decorators";

export type TMessageFile = AttachmentBuilder | AttachmentPayload | BufferResolvable;

export interface IMessageOptions {
    content?: string;
    embeds?: Array<EmbedBuilder>;
    components?: Array<ActionRowBuilder<MessageActionRowComponentBuilder>>;
    files?: Array<TMessageFile>;
    ephemeral?: boolean;
    fetch?: boolean;
    sendToChannel?: boolean;
}

export type TMessagePayload = string | EmbedBuilder | IMessageOptions;

/**
 * Abstract command context class responsible for wrapping the interactions
 * coming from Discord.js
 */
export abstract class CommandContext {
    /**
     * Whether the command was deferred or not.
     */
    public isDeferred = false;

    /**
     * Store our response message.
     */
    public responseMessage: Message | null = null;

    /**
     * Command state of this execution.
     */
    public readonly state: ICommandState = {} as ICommandState;

    /**
     * Whether we're in the context of a slash command.
     */
    public abstract readonly isSlash: boolean;

    /**
     * Name of the executed command.
     */
    public abstract readonly commandName: string;

    /**
     * Injected metadata of the executed command.
     */
    declare public metadata: ICommandMetadata;

    /**
     * Author of the executed command.
     */
    public abstract readonly author: User;

    /**
     * Guild in which the command was executed.
     * null if DMs.
     */
    public abstract readonly guild: Guild | null;

    /**
     * Channel in which the command was executed.
     */
    public abstract readonly channel: TextBasedChannel | null;

    /**
     * Guild member data of the user if the command was executed in a guild.
     */
    public abstract readonly member: GuildMember | APIInteractionGuildMember | null;

    /**
     * Get subcommand group (primarily for slash commands).
     */
    public abstract getSubcommandGroup(): string | null;

    /**
     * Get subcommand (primarily for slash commands).
     */
    public abstract getSubcommand(): string | null;

    /**
     * Let Discord know that we might take a bit of time to respond.
     *
     * @param ephemeral Whether the interaction should only be visible to the user who executed the command.
     */
    public abstract defer(ephemeral?: boolean): Promise<void>;

    /**
     * Get a URL pointing to the origin of the command's execution.
     * Can be used for logging or providing a "jump to" link.
     *
     * @returns {string} The Discord URL to the channel or DM.
     */
    public abstract origin(): string;

    /**
     * Unified method to respond to both messages and interactions.
     */
    public abstract respond(options: TMessagePayload): Promise<Message | InteractionResponse | null>;

    /**
     * Unified method to reply to both messages and interactions.
     */
    public abstract reply(options: TMessagePayload): Promise<Message | InteractionResponse | null>;

    /**
     * Sends a new brand message to the channel.
     */
    public abstract followUp(options: TMessagePayload): Promise<Message | InteractionResponse | null>;

    /**
     * Retrieves the message object for the initial reply sent by the bot.
     * Caches the result to avoid repeated API calls.
     */
    public abstract fetchReply(): Promise<Message | null>;

    /**
     * Normalize payload so that we could pass it to discord.js
     */
    protected normalizePayload(options: TMessagePayload): IMessageOptions {
        if (typeof options === "string") return { content: options };
        if (options instanceof EmbedBuilder) return { embeds: [options] };
        return options;
    }
}
