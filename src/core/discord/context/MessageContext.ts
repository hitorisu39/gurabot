import { ChannelType, InteractionReplyOptions, Message, MessagePayload, MessageReplyOptions } from "discord.js";

import { CommandContext, TMessagePayload } from "./CommandContext";

export class MessageContext extends CommandContext {
    public readonly isSlash = false;
    public readonly commandName: string;
    public readonly rawContent: string;

    constructor(
        public readonly message: Message,
        public readonly prefix: string,
    ) {
        super();
        const contentWithoutPrefix = message.content.slice(prefix.length).trim();
        const rawArgs = contentWithoutPrefix.split(/ +/);

        this.commandName = rawArgs.shift()?.toLowerCase() || "";
        this.rawContent = contentWithoutPrefix.slice(this.commandName.length).trim();
    }

    public get author() {
        return this.message.author;
    }

    public get guild() {
        return this.message.guild;
    }

    public get channel() {
        return this.message.channel;
    }

    public get member() {
        return this.message.member;
    }

    public async defer(): Promise<void> {
        if (this.isDeferred) return;

        if (this.channel.isSendable()) await this.channel.sendTyping();

        this.isDeferred = true;
    }

    public async respond(options: TMessagePayload): Promise<Message | null> {
        const payload = this.normalizePayload(options);

        if (this.responseMessage) return this.responseMessage.edit(payload);

        if (this.channel.isSendable()) {
            this.responseMessage = await this.channel.send(payload);
            return this.responseMessage;
        }

        return null;
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

    public async reply(options: TMessagePayload): Promise<Message> {
        const payload = this.normalizePayload(options);

        if (this.responseMessage) return this.responseMessage.edit(payload);

        this.responseMessage = await this.message.reply(payload);
        return this.responseMessage;
    }

    public async followUp(options: TMessagePayload): Promise<Message | null> {
        const payload = this.normalizePayload(options);
        if (this.channel.isSendable()) return await this.channel.send(payload);
        return null;
    }

    public async fetchReply(): Promise<Message | null> {
        return this.responseMessage;
    }

    public getSubcommandGroup(): string | null {
        return null;
    }

    public getSubcommand(): string | null {
        return null;
    }
}
