import { Message } from "discord.js";
import { CommandContext } from "./CommandContext";
import { type TMessagePayload } from "./MessagePayload";
import { Trace } from "@/core/decorators";

export class MessageContext extends CommandContext {
    public readonly isSlash = false;
    public readonly commandName: string;
    public readonly rawContent: string;

    /**
     * Message commands don't have Discord's interaction
     * deferred state, so we maintain our own small flag.
     */
    private deferred = false;

    public constructor(
        public readonly message: Message,
        public readonly prefix: string,
    ) {
        super();

        const contentWithoutPrefix = message.content.slice(prefix.length).trim();
        const rawArgs = contentWithoutPrefix.split(/ +/);

        this.commandName = rawArgs.shift()?.toLowerCase() ?? "";
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

    public get isDeferred(): boolean {
        return this.deferred;
    }

    /**
     * For message commands, "defer" simply means displaying
     * Discord's typing indicator.
     */
    public async defer(_ephemeral?: boolean): Promise<void> {
        if (this.deferred) {
            return;
        }

        this.deferred = true;

        if (this.channel.isSendable()) {
            void this.channel.sendTyping().catch(() => undefined);
        }
    }

    /**
     * Send/edit the primary command response.
     */
    @Trace()
    public async respond(options: TMessagePayload): Promise<Message | null> {
        if (this.responseMessage) {
            this.responseMessage = await this.responseMessage.edit(this.toMessageEditPayload(options));

            return this.responseMessage;
        }

        if (!this.channel.isSendable()) {
            return null;
        }

        this.responseMessage = await this.channel.send(this.toMessageCreatePayload(options));

        return this.responseMessage;
    }

    /**
     * Send an additional channel message.
     */
    @Trace()
    public async followUp(options: TMessagePayload): Promise<Message | null> {
        if (!this.channel.isSendable()) {
            return null;
        }

        return this.channel.send(this.toMessageCreatePayload(options));
    }

    /**
     * Retrieve the already-cached primary response.
     */
    public async fetchResponse(): Promise<Message | null> {
        return this.responseMessage;
    }

    /**
     * A message command has an exact originating message,
     * so we can provide a more specific URL than the base class.
     */
    public override origin(): string {
        return this.message.url;
    }

    public getSubcommandGroup(): string | null {
        return null;
    }

    public getSubcommand(): string | null {
        return null;
    }
}
