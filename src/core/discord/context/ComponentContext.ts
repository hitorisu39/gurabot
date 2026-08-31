import {
    APIModalInteractionResponseCallbackData,
    InteractionResponse,
    Message,
    MessageComponentInteraction,
    MessageCreateOptions,
    MessageEditOptions,
    MessageFlags,
    ModalBuilder,
    ModalSubmitInteraction,
} from "discord.js";
import { TMessagePayload } from "./CommandContext";
import { InteractionContext } from "./InteractionContext";
import { EApplicationError, Exception } from "@domain/core/Exception";

export class ComponentContext extends InteractionContext {
    public params: Record<string, string> = {};

    public constructor(public readonly interaction: MessageComponentInteraction | ModalSubmitInteraction) {
        super();
    }

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

    public get customID(): string {
        return this.interaction.customId;
    }

    /**
     * Sends a new response to the component interaction.
     *
     * Unlike update(), this does not modify the source message.
     */
    public async respond(options: TMessagePayload): Promise<Message | InteractionResponse> {
        return this.reply(options);
    }

    /**
     * Shows a modal to the user.
     *
     * This MUST be the first response to the interaction.
     * You cannot call this if deferUpdate(), deferReply(), or reply()
     * has already been used.
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
            return;
        }

        throw new Exception(EApplicationError.INTERNAL_ERROR, "This interaction type does not support showing modals.");
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

    /**
     * Defers an update to the component's source message.
     */
    public async deferUpdate(): Promise<void> {
        if (this.isDeferred) return;

        if (
            this.interaction.isMessageComponent() ||
            (this.interaction.isModalSubmit() && this.interaction.isFromMessage())
        ) {
            await this.interaction.deferUpdate();
        } else {
            await this.interaction.deferReply({
                flags: MessageFlags.Ephemeral,
            });
        }

        this.isDeferred = true;
    }

    /**
     * Defers a new response to this interaction.
     *
     * This does not update the component's source message.
     */
    public async deferReply(ephemeral = false): Promise<void> {
        if (this.isDeferred) return;
        await this.interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {});
        this.isDeferred = true;
    }

    /**
     * Sends a new response to the interaction.
     *
     * If deferReply() was called first, this completes that response.
     */
    public async reply(options: TMessagePayload, ephemeral = false): Promise<Message | InteractionResponse> {
        const payload = this.normalizePayload(options);

        if (ephemeral) {
            payload.ephemeral = true;
        }

        if (this.interaction.deferred || this.interaction.replied) {
            return this.interaction.editReply(payload);
        }

        return this.interaction.reply(payload);
    }

    public get values(): Array<string> {
        if (this.interaction.isAnySelectMenu()) {
            return this.interaction.values;
        }

        return [];
    }

    public getTextInput(customId: string): string | null {
        if (this.interaction.isModalSubmit()) {
            return this.interaction.fields.getTextInputValue(customId) || null;
        }

        return null;
    }

    public async editSourceMessage(payload: TMessagePayload): Promise<void> {
        const message = this.interaction.message;

        if (!message) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "This component does not have a source message.");
        }

        await message.edit(payload as MessageEditOptions);
    }

    public async deleteSourceMessage(): Promise<void> {
        const message = this.interaction.message;

        if (!message) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "This component does not have a source message.");
        }

        await message.delete();
    }

    public async sendChannelMessage(payload: MessageCreateOptions): Promise<void> {
        const channel = this.interaction.channel;

        if (!channel?.isSendable()) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "The component channel is not sendable.");
        }

        await channel.send(payload);
    }
}
