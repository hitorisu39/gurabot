import {
    APIModalInteractionResponseCallbackData,
    Message,
    MessageComponentInteraction,
    MessageFlags,
    ModalBuilder,
    ModalSubmitInteraction,
} from "discord.js";
import { DiscordContext } from "./DiscordContext";
import { TMessagePayload } from "./MessagePayload";
import { EApplicationError, Exception } from "@domain/core/Exception";

type TComponentAcknowledgement = "none" | "reply" | "update" | "modal";

/**
 * Context surrounding a message component or modal submission.
 * There are two intentionally distinct response paths:
 *
 * respond() -> creates/edits a NEW response
 * update() -> updates the SOURCE message
 */
export class ComponentContext extends DiscordContext {
    public params: Record<string, string> = {};

    /**
     * Tracks HOW this interaction was acknowledged.
     *
     * discord.js exposes whether an interaction has been acknowledged, but that alone isn't enough for components:
     * deferReply()  -> editReply edits our new response
     * deferUpdate() -> editReply edits the source message
     *
     * We therefore need to remember which semantic path this context chose.
     */
    private acknowledgement: TComponentAcknowledgement = "none";

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

    public get isDeferred(): boolean {
        return this.interaction.deferred;
    }

    public get customID(): string {
        return this.interaction.customId;
    }

    /**
     * Sends/edits this component's NEW response.
     * This never intentionally modifies the component's source message.
     */
    public async respond(options: TMessagePayload): Promise<Message | null> {
        /**
         * If we've already created a separate response message, edit that exact message.
         */
        if (this.responseMessage) {
            this.responseMessage = await this.responseMessage.edit(this.toMessageEditPayload(options));

            return this.responseMessage;
        }

        switch (this.acknowledgement) {
            case "reply": {
                this.responseMessage = await this.interaction.editReply(this.toInteractionEditPayload(options));
                return this.responseMessage;
            }
            case "update": {
                /**
                 * The interaction has already been acknowledged as a source-message update.
                 * Creating a new response therefore requires a  follow-up rather than editReply(), because
                 * editReply() points to the source message.
                 */
                this.responseMessage = await this.interaction.followUp(this.toInteractionReplyPayload(options));
                return this.responseMessage;
            }
            case "modal": {
                throw new Exception(
                    EApplicationError.INTERNAL_ERROR,
                    "Cannot respond to a component interaction after it has been acknowledged with a modal.",
                );
            }
            case "none":
                break;
        }

        /**
         * If something bypassed ComponentContext and acknowledged  the raw interaction directly, we can no longer safely
         * know whether editReply() targets a new response or the component's source message.
         */
        if (this.interaction.deferred || this.interaction.replied) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "Component interaction was acknowledged outside ComponentContext; response mode is unknown.",
            );
        }

        await this.interaction.reply(this.toInteractionReplyPayload(options));
        this.acknowledgement = "reply";
        return this.fetchResponse();
    }

    /**
     * Send an additional response.
     */
    public async followUp(options: TMessagePayload): Promise<Message | null> {
        if (this.acknowledgement === "none" && !this.interaction.deferred && !this.interaction.replied) {
            return this.respond(options);
        }

        if (this.acknowledgement === "modal") {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "Cannot send a follow-up from an interaction that was acknowledged with a modal.",
            );
        }

        return this.interaction.followUp(this.toInteractionReplyPayload(options));
    }

    /**
     * Defer a NEW response.
     * Equivalent to deferReply(), but exposed through the common InteractionContext API.
     */
    public async defer(ephemeral = false): Promise<void> {
        if (this.interaction.deferred || this.interaction.replied) {
            return;
        }

        await this.interaction.deferReply({
            flags: ephemeral ? MessageFlags.Ephemeral : undefined,
        });

        this.acknowledgement = "reply";
    }

    public async deferReply(ephemeral = false): Promise<void> {
        return this.defer(ephemeral);
    }

    /**
     * Defer an UPDATE to the component's source message.
     */
    public async deferUpdate(): Promise<void> {
        this.assertHasSourceMessage();

        if (this.acknowledgement === "update") {
            return;
        }

        if (this.interaction.deferred || this.interaction.replied) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "Cannot defer a component update after the interaction has already been acknowledged.",
            );
        }

        await this.interaction.deferUpdate();
        this.acknowledgement = "update";
    }

    /**
     * Update the message the component originated from.
     * Unlike respond(), this method ALWAYS means source-message  mutation.
     */
    public async update(options: TMessagePayload): Promise<void> {
        this.assertHasSourceMessage();

        if (this.acknowledgement === "update") {
            await this.interaction.editReply(this.toInteractionEditPayload(options));

            return;
        }

        if (
            this.acknowledgement === "reply" ||
            this.acknowledgement === "modal" ||
            this.interaction.deferred ||
            this.interaction.replied
        ) {
            await this.editSourceMessage(options);
            return;
        }

        const payload = this.toInteractionUpdatePayload(options);

        if (this.interaction.isMessageComponent()) {
            await this.interaction.update(payload);
            this.acknowledgement = "update";
            return;
        }

        if (this.interaction.isModalSubmit() && this.interaction.isFromMessage()) {
            await this.interaction.update(payload);
            this.acknowledgement = "update";
            return;
        }

        throw new Exception(
            EApplicationError.INTERNAL_ERROR,
            "Cannot update an interaction that does not have a source message.",
        );
    }

    /**
     * Shows a modal.
     * This must consume the interaction's initial acknowledgement.
     */
    public async showModal(modal: ModalBuilder | APIModalInteractionResponseCallbackData): Promise<void> {
        if (this.interaction.deferred || this.interaction.replied || this.acknowledgement !== "none") {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "Cannot show a modal for an interaction that has already been acknowledged.",
            );
        }

        if (!this.interaction.isMessageComponent()) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                "This interaction type does not support showing modals.",
            );
        }

        await this.interaction.showModal(modal);
        this.acknowledgement = "modal";
    }

    /**
     * Fetch this context's NEW response message.
     * Source-message updates aren't considered respond() results, so update/deferUpdate contexts return null here unless
     * respond() later created a follow-up response.
     */
    public async fetchResponse(): Promise<Message | null> {
        if (this.responseMessage) {
            return this.responseMessage;
        }

        if (this.acknowledgement !== "reply") {
            return null;
        }

        this.responseMessage = await this.interaction.fetchReply();

        return this.responseMessage;
    }

    /**
     * Select-menu values.
     */
    public get values(): Array<string> {
        if (this.interaction.isAnySelectMenu()) {
            return this.interaction.values;
        }

        return [];
    }

    /**
     * Retrieve a modal text input.
     */
    public getTextInput(customId: string): string | null {
        if (!this.interaction.isModalSubmit()) {
            return null;
        }

        return this.interaction.fields.getTextInputValue(customId) || null;
    }

    /**
     * Explicitly edit the component's source message.
     * This does not affect responseMessage.
     */
    public async editSourceMessage(options: TMessagePayload): Promise<void> {
        const message = this.getSourceMessage();
        await message.edit(this.toMessageEditPayload(options));
    }

    /**
     * Explicitly delete the component's source message.
     */
    public async deleteSourceMessage(): Promise<void> {
        const message = this.getSourceMessage();

        await message.delete();
    }

    /**
     * Ensure the interaction actually originated from a message.
     */
    private assertHasSourceMessage(): void {
        this.getSourceMessage();
    }

    /**
     * Retrieve the message this component/modal originated from.
     */
    private getSourceMessage(): Message {
        if (this.interaction.isMessageComponent()) {
            return this.interaction.message;
        }

        if (this.interaction.isModalSubmit() && this.interaction.isFromMessage()) {
            return this.interaction.message;
        }

        throw new Exception(
            EApplicationError.INTERNAL_ERROR,
            "This component interaction does not have a source message.",
        );
    }
}
