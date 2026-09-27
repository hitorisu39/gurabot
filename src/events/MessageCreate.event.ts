import { Import } from "@/core/decorators";
import { AbstractDiscordEvent } from "@/core/discord/AbstractDiscordEvent";
import { MessageContext } from "@/core/discord/context/MessageContext";
import { ChannelService } from "@/modules/channel/Channel.service";
import { GuildService } from "@/modules/guild/Guild.service";
import { ChannelObserverService } from "@/modules/osu/ChannelObserver.service";
import { discordRegexSpecialCharacters } from "@domain/discord/configs/Discord.config";
import { OmitPartialGroupDMChannel, Message, PermissionFlagsBits } from "discord.js";

export class MessageCreateEvent extends AbstractDiscordEvent<"messageCreate"> {
    public readonly event = "messageCreate";

    @Import() declare private readonly guildService: GuildService;
    @Import() declare private readonly channelService: ChannelService;
    @Import() declare private readonly channelObserverService: ChannelObserverService;

    public async execute(message: OmitPartialGroupDMChannel<Message<boolean>>): Promise<void> {
        /**
         * Observe channel context sent by users and other bots.
         * Context sent by us is observed via the response event.
         */
        if (message.author.id !== this.discord.client.user?.id) {
            this.channelObserverService
                .observe(message)
                .catch((error) =>
                    this.logger.warn(
                        { error, messageID: message.id },
                        "Failed to observe channel context from message.",
                    ),
                );
        }

        if (message.author.bot) return;

        if (message.guild && message.channel.isTextBased() && !message.channel.isDMBased()) {
            const member = message.guild.members.me;
            if (member && !message.channel.permissionsFor(member).has(PermissionFlagsBits.SendMessages)) return;
        }

        const defaultPrefix = this.config.app.prefix;
        const content = message.content;

        if (!content.startsWith(defaultPrefix) && message.guildId) {
            const potentialPrefix = content.slice(0, 3);
            if (!discordRegexSpecialCharacters.test(potentialPrefix)) return;
        }

        let prefix: string;

        if (message.guildId) {
            prefix = await this.guildService.getPrefix(message.guildId);
        } else {
            prefix = message.content.startsWith(defaultPrefix) ? defaultPrefix : "";
        }

        if (!message.content.startsWith(prefix)) {
            return;
        }

        const ctx = new MessageContext(message, prefix, this.contextEvents);
        this.dispatcher.dispatch("discord", "command", ctx);
    }
}
