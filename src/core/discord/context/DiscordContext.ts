import {
    APIInteractionGuildMember,
    EmbedBuilder,
    Guild,
    GuildMember,
    InteractionEditReplyOptions,
    InteractionReplyOptions,
    InteractionUpdateOptions,
    Message,
    MessageCreateOptions,
    MessageEditOptions,
    MessageFlags,
    TextBasedChannel,
    User,
} from "discord.js";

import { IMessageOptions, IResponseOptions, TMessagePayload } from "./MessagePayload";

export type TDiscordResponseKind = "respond" | "followUp";

export interface IDiscordResponseEvent {
    readonly ctx: DiscordContext;
    readonly kind: TDiscordResponseKind;
    readonly message: Message;
}

export interface IDiscordContextEvents {
    response?(event: IDiscordResponseEvent): void;
}

/**
 * Base abstraction for every execution context.
 * Defines the behaviour shared between message commands, slash commands, components and modals.
 * Context-specific behaviour belongs in subclasses.
 */
export abstract class DiscordContext {
    /**
     * Cached primary response message, if one exists.
     */
    public responseMessage: Message | null = null;

    /**
     * User responsible for this context.
     */
    public abstract readonly author: User;

    /**
     * Guild in which this context exists.
     * null outside of guilds.
     */
    public abstract readonly guild: Guild | null;

    /**
     * Channel in which this context exists.
     */
    public abstract readonly channel: TextBasedChannel | null;

    /**
     * Guild member associated with the author.
     * null outside of guilds.
     */
    public abstract readonly member: GuildMember | APIInteractionGuildMember | null;

    /**
     * Whether the context's response has been deferred.
     */
    public abstract get isDeferred(): boolean;

    protected constructor(private readonly events: IDiscordContextEvents = {}) {}

    /**
     * Send/edit this context's primary response.
     * The actual Discord implementation is delegated to doRespond(),
     * while lifecycle events are handled centrally here.
     */
    public async respond(options: TMessagePayload): Promise<Message | null> {
        const message = await this.doRespond(options);
        if (message) {
            this.emitResponse("respond", message);
        }

        return message;
    }

    /**
     * Send an additional response.
     */
    public async followUp(options: TMessagePayload): Promise<Message | null> {
        const message = await this.doFollowUp(options);
        if (message) {
            this.emitResponse("followUp", message);
        }

        return message;
    }

    /**
     * Discord-specific primary response implementation.
     */
    protected abstract doRespond(options: TMessagePayload): Promise<Message | null>;

    /**
     * Discord-specific follow-up implementation.
     */
    protected abstract doFollowUp(options: TMessagePayload): Promise<Message | null>;

    /**
     * Let Discord know that producing the primary response
     * may take some time.
     */
    public abstract defer(ephemeral?: boolean): Promise<void>;

    /**
     * Retrieve the primary response message, if one exists.
     */
    public abstract fetchResponse(): Promise<Message | null>;

    /**
     * URL representing the origin of this context.
     */
    public origin(): string {
        if (this.guild && this.channel) {
            return `https://discord.com/channels/${this.guild.id}/${this.channel.id}`;
        }

        if (this.channel) {
            return `https://discord.com/channels/@me/${this.channel.id}`;
        }

        return "https://discord.com";
    }

    /**
     * Send an ordinary Discord message to a user or channel.
     * This is completely independent of the context's primary interaction response.
     */
    public async sendTo(target: User | TextBasedChannel, options: TMessagePayload): Promise<Message | null> {
        const payload = this.toMessageCreatePayload(options);

        if (target instanceof User) {
            return target.send(payload);
        }

        if (target.isSendable()) {
            return target.send(payload);
        }

        return null;
    }

    /**
     * Send an ordinary message to the context's channel.
     */
    public async sendToChannel(options: TMessagePayload): Promise<Message | null> {
        if (!this.channel) {
            return null;
        }

        return this.sendTo(this.channel, options);
    }

    private emitResponse(kind: TDiscordResponseKind, message: Message): void {
        this.events.response?.({
            ctx: this,
            kind,
            message,
        });
    }

    /**
     * Normalize shorthand payloads into our internal
     * response payload shape.
     */
    protected normalizePayload(options: TMessagePayload): IResponseOptions {
        if (typeof options === "string") {
            return {
                content: options,
            };
        }

        if (options instanceof EmbedBuilder) {
            return {
                embeds: [options],
            };
        }

        return options;
    }

    /**
     * Convert our generic payload into an ordinary
     * Discord message-create payload.
     */
    protected toMessageCreatePayload(options: TMessagePayload): MessageCreateOptions {
        const payload = {
            ...this.normalizePayload(options),
        };

        delete payload.ephemeral;
        return payload as MessageCreateOptions;
    }

    /**
     * Convert our generic payload into an ordinary
     * Discord message-edit payload.
     */
    protected toMessageEditPayload(options: TMessagePayload): MessageEditOptions {
        const payload = {
            ...this.normalizePayload(options),
        };

        delete payload.ephemeral;
        return payload as MessageEditOptions;
    }

    /**
     * Convert our generic payload into an interaction reply.
     */
    protected toInteractionReplyPayload(options: TMessagePayload): InteractionReplyOptions {
        const normalized = this.normalizePayload(options);
        const payload: IResponseOptions = {
            ...normalized,
        };

        delete payload.ephemeral;

        return {
            ...payload,
            ...(normalized.ephemeral ? { flags: MessageFlags.Ephemeral } : {}),
        } as InteractionReplyOptions;
    }

    /**
     * Convert our generic payload into an interaction
     * editReply() payload.
     *
     * Ephemerality cannot be changed after the interaction
     * has already been acknowledged, so it is stripped.
     */
    protected toInteractionEditPayload(options: TMessagePayload): InteractionEditReplyOptions {
        const payload = {
            ...this.normalizePayload(options),
        };

        delete payload.ephemeral;
        return payload as InteractionEditReplyOptions;
    }

    /**
     * Convert our generic payload into a component update()
     * payload.
     */
    protected toInteractionUpdatePayload(options: TMessagePayload): InteractionUpdateOptions {
        const payload = {
            ...this.normalizePayload(options),
        };

        delete payload.ephemeral;
        return payload as InteractionUpdateOptions;
    }

    /**
     * Return only the message data.
     */
    protected toMessageOptions(options: TMessagePayload): IMessageOptions {
        const payload = {
            ...this.normalizePayload(options),
        };

        delete payload.ephemeral;
        return payload;
    }
}
