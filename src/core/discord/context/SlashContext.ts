import { ChatInputCommandInteraction, Message, MessageFlags } from "discord.js";
import { CommandContext } from "./CommandContext";
import { type TMessagePayload } from "./MessagePayload";
import { Trace } from "@/core/decorators";

export class SlashContext extends CommandContext {
    public readonly isSlash = true;

    public readonly commandName: string;

    public constructor(public readonly interaction: ChatInputCommandInteraction) {
        super();

        this.commandName = interaction.commandName;
    }

    public get author() {
        return this.interaction.user;
    }

    public get guild() {
        return this.interaction.guild;
    }

    public get channel() {
        return this.interaction.channel;
    }

    public get member() {
        return this.interaction.member;
    }

    public get isDeferred(): boolean {
        return this.interaction.deferred;
    }

    public getSubcommandGroup(): string | null {
        return this.interaction.options.getSubcommandGroup(false);
    }

    public getSubcommand(): string | null {
        return this.interaction.options.getSubcommand(false);
    }

    @Trace()
    public async defer(ephemeral = false): Promise<void> {
        if (this.interaction.deferred || this.interaction.replied) {
            return;
        }

        await this.interaction.deferReply({
            flags: ephemeral ? MessageFlags.Ephemeral : undefined,
        });
    }

    /**
     * Send/edit the primary slash-command response.
     */
    @Trace()
    public async respond(options: TMessagePayload): Promise<Message | null> {
        if (this.interaction.deferred || this.interaction.replied) {
            this.responseMessage = await this.interaction.editReply(this.toInteractionEditPayload(options));
            return this.responseMessage;
        }

        await this.interaction.reply(this.toInteractionReplyPayload(options));
        return this.fetchResponse();
    }

    /**
     * Send another response after the primary response.
     * If nothing has acknowledged the interaction yet, promote this to the primary response.
     */
    @Trace()
    public async followUp(options: TMessagePayload): Promise<Message | null> {
        if (!this.interaction.deferred && !this.interaction.replied) {
            return this.respond(options);
        }

        return this.interaction.followUp(this.toInteractionReplyPayload(options));
    }

    /**
     * Fetch and cache the primary interaction response.
     */
    public async fetchResponse(): Promise<Message | null> {
        if (this.responseMessage) {
            return this.responseMessage;
        }

        if (!this.interaction.replied && !this.interaction.deferred) {
            return null;
        }

        this.responseMessage = await this.interaction.fetchReply();
        return this.responseMessage;
    }
}
