import {
    ChatInputCommandInteraction,
    InteractionReplyOptions,
    InteractionResponse,
    Message,
    MessageFlags,
} from "discord.js";

import { CommandContext, TMessagePayload } from "./CommandContext";

export class SlashContext extends CommandContext {
    public readonly isSlash = true;
    public readonly commandName: string;

    constructor(public readonly interaction: ChatInputCommandInteraction) {
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

    public getSubcommandGroup(): string | null {
        return this.interaction.options.getSubcommandGroup(false);
    }

    public getSubcommand(): string | null {
        return this.interaction.options.getSubcommand(false);
    }

    public async defer(ephemeral?: boolean): Promise<void> {
        if (this.isDeferred) return;
        await this.interaction.deferReply({ flags: ephemeral ? MessageFlags.Ephemeral : undefined });
        this.isDeferred = true;
    }

    public async respond(options: TMessagePayload): Promise<Message | InteractionResponse> {
        return this.reply(options);
    }

    public origin(): string {
        if (this.guild && this.channel) {
            return `https://discord.com/channels/${this.guild.id}/${this.channel.id}/#`;
        }

        if (this.channel) {
            return `https://discord.com/channels/@me/${this.channel.id}/#`;
        }

        return "https://discord.com";
    }

    public async reply(options: TMessagePayload): Promise<Message | InteractionResponse> {
        const payload = this.normalizePayload(options);
        const fetchReply = payload.fetch ?? false;

        if (this.interaction.deferred || this.interaction.replied) return this.interaction.editReply(payload);
        const response = await this.interaction.reply({ ...payload, withResponse: fetchReply });

        if (response instanceof Message) this.responseMessage = response;

        return response;
    }

    public async followUp(options: TMessagePayload): Promise<Message | InteractionResponse | null> {
        const payload = this.normalizePayload(options);

        if (payload.sendToChannel && this.channel?.isSendable()) {
            return this.channel.send(payload);
        }

        if (!this.interaction.deferred && !this.interaction.replied) {
            return this.reply(payload);
        }

        return this.interaction.followUp(payload);
    }

    public async fetchReply(): Promise<Message | null> {
        if (this.responseMessage) return this.responseMessage;

        if (this.interaction.replied || this.interaction.deferred) {
            this.responseMessage = await this.interaction.fetchReply();
            return this.responseMessage;
        }

        return null;
    }
}
