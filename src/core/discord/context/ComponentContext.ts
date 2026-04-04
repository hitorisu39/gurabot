import {
    MessageComponentInteraction,
    ModalSubmitInteraction,
    Message,
    InteractionResponse,
    MessageFlags,
    ModalBuilder,
    APIModalInteractionResponseCallbackData,
} from "discord.js";
import { TMessagePayload, IMessageOptions } from "./CommandContext";
import { EApplicationError, Exception } from "@domain/core/Exception";

export class ComponentContext {
    public isDeferred = false;

    public params: Record<string, string> = {};

    constructor(public readonly interaction: MessageComponentInteraction | ModalSubmitInteraction) {}

    public get author() {
        return this.interaction.user;
    }
    public get member() {
        return this.interaction.member;
    }
    public get guild() {
        return this.interaction.guild;
    }
    public get channel() {
        return this.interaction.channel;
    }
    public get customID() {
        return this.interaction.customId;
    }

    protected normalizePayload(options: TMessagePayload): IMessageOptions {
        if (typeof options === "string") return { content: options };
        if (options && "data" in options) return { embeds: [options] };
        return options as IMessageOptions;
    }

    /**
     * Shows a modal to the user.
     * Note: This MUST be the first response to the interaction.
     * You cannot call this if deferUpdate() or reply() has already been used.
     */
    public async showModal(modal: ModalBuilder | APIModalInteractionResponseCallbackData): Promise<void> {
        if (this.interaction.deferred || this.interaction.replied || this.isDeferred) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "Cannot show a modal for an interaction that has already been acknowledged.",
            );
        }

        if (this.interaction instanceof MessageComponentInteraction) {
            await this.interaction.showModal(modal);
        } else {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "This interaction type does not support showing modals.",
            );
        }
    }

    /**
     * Updates the message the component is attached to.
     */
    public async update(options: TMessagePayload): Promise<Message | InteractionResponse> {
        const payload = this.normalizePayload(options);

        if (this.interaction.deferred || this.interaction.replied) {
            return this.interaction.editReply(payload);
        }

        if (this.interaction.isModalSubmit() && !this.interaction.isFromMessage()) {
            return this.interaction.reply(payload);
        }

        return this.interaction.update(payload);
    }

    public async deferUpdate(): Promise<void> {
        if (this.isDeferred) return;

        if (
            this.interaction.isMessageComponent() ||
            (this.interaction.isModalSubmit() && this.interaction.isFromMessage())
        ) {
            await this.interaction.deferUpdate();
        } else {
            await this.interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }

        this.isDeferred = true;
    }

    public async reply(options: TMessagePayload, ephemeral = false): Promise<Message | InteractionResponse> {
        const payload = this.normalizePayload(options);
        if (ephemeral) payload.ephemeral = true;

        if (this.interaction.deferred || this.interaction.replied) {
            return this.interaction.editReply(payload);
        }

        return this.interaction.reply(payload);
    }

    public get values(): Array<string> {
        if (this.interaction.isAnySelectMenu()) return this.interaction.values;
        return [];
    }

    public getTextInput(customId: string): string | null {
        if (this.interaction.isModalSubmit()) {
            return this.interaction.fields.getTextInputValue(customId) || null;
        }
        return null;
    }
}
