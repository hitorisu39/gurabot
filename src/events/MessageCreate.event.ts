import { Import } from "@/core/decorators";
import { AbstractDiscordEvent } from "@/core/discord/AbstractDiscordEvent";
import { MessageContext } from "@/core/discord/context/MessageContext";
import { ChannelService } from "@/modules/channel/Channel.service";
import { GuildService } from "@/modules/guild/Guild.service";
import { BeatmapResolverService } from "@/modules/osu/BeatmapResolver.service";
import { discordRegexSpecialCharacters } from "@domain/discord/configs/Discord.config";
import { OmitPartialGroupDMChannel, Message, PermissionFlagsBits } from "discord.js";

export class MessageCreateEvent extends AbstractDiscordEvent<"messageCreate"> {
    public readonly event = "messageCreate";

    @Import() declare private readonly guildService: GuildService;
    @Import() declare private readonly channelService: ChannelService;
    @Import() declare private readonly beatmapResolverService: BeatmapResolverService;

    public async execute(message: OmitPartialGroupDMChannel<Message<boolean>>): Promise<void> {
        // Get the possible beatmap from the message before we process it.
        const matched = this.beatmapResolverService.fromMessage(message);
        if (matched) this.channelService.storeBeatmap(message.channelId, matched).catch(this.logger.error);

        if (message.author.bot) return;

        if (message.guild && message.channel.isTextBased() && !message.channel.isDMBased()) {
            const member = message.guild.members.me;
            if (member && !message.channel.permissionsFor(member).has(PermissionFlagsBits.SendMessages)) return;
        }

        const defaultPrefix = this.config.app.prefix;
        const content = message.content;

        if (!content.startsWith(defaultPrefix)) {
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

        const ctx = new MessageContext(message, prefix);
        this.dispatcher.dispatch("discord", "command", ctx);
    }
}
