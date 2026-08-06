import { Import, Inject, IsEnum, IsString, IsUser, Option } from "@/core/decorators";
import { User } from "discord.js";
import { AdapterProvider, GameMode } from "@generated/adapter/types";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { UserService } from "@/modules/user/User.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ProviderMeta } from "@generated/adapter";
import { GuildService } from "@/modules/guild/Guild.service";
import { CommandOption } from "@domain/core/Command";
import { BeatmapResolverService } from "@/modules/osu/BeatmapResolver.service";
import { ChannelService } from "@/modules/channel/Channel.service";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { AbstractSessionCommand } from "../AbstractSessionCommand";

export interface IResolvedOsuTarget {
    query: string | number;
    mode: GameMode;
    server: AdapterProvider;
}

export abstract class AbstractOsuCommand extends AbstractSessionCommand {
    @Import() declare protected readonly userService: UserService;
    @Import() declare protected readonly guildService: GuildService;
    @Import() declare protected readonly channelService: ChannelService;
    @Import() declare protected readonly beatmapResolverService: BeatmapResolverService;

    @Option("discord", "Specify a user linked to the bot")
    @IsUser()
    declare protected readonly discordUser: CommandOption<User>;

    @Option("name", "Specify osu! username")
    @IsString()
    @Inject()
    declare protected readonly name: CommandOption<string>;

    @Option("mode", "Specify osu! gamemode")
    @IsEnum(GameMode)
    declare protected readonly mode: CommandOption<GameMode>;

    @Option("server", "Specify a server")
    @IsEnum(AdapterProvider)
    declare protected readonly server: CommandOption<AdapterProvider>;

    protected forcedMode?: GameMode;

    protected async resolveTarget(ctx: CommandContext): Promise<IResolvedOsuTarget> {
        const performer = await this.userService.get(ctx.author.id);
        const guild = ctx.guild ? await this.guildService.get(ctx.guild.id) : null;

        const server = this.server.unwrapUnchecked() ?? performer?.server ?? guild?.server ?? AdapterProvider.Bancho;

        const mode =
            this.forcedMode ?? this.mode.unwrapUnchecked() ?? performer?.mode ?? guild?.mode ?? GameMode.Standard;

        let query: string | number;

        if (this.name.some()) {
            const value = this.name.unwrap().trim();
            const mentionedUserID = this.parseDiscordMention(value);

            if (mentionedUserID) {
                query = await this.resolveLinkedUser(mentionedUserID, server);
            } else {
                query = value;
            }
        } else if (this.discordUser.some()) {
            query = await this.resolveLinkedUser(this.discordUser.unwrap().id, server);
        } else {
            query = await this.resolveLinkedUser(ctx.author.id, server, true);
        }

        return { query, mode, server };
    }

    private parseDiscordMention(value: string): string | null {
        const match = value.match(/^<@!?(\d+)>$/);
        return match?.[1] ?? null;
    }

    private async resolveLinkedUser(userID: string, server: AdapterProvider, isCommandAuthor = false): Promise<number> {
        const linked = await this.userService.getLinkedID(userID, server);

        if (!linked) {
            if (isCommandAuthor) {
                throw new Exception(
                    EApplicationError.INPUT_ERROR,
                    `You haven't linked an account on ${ProviderMeta[server].name}. Please specify a name or use \`/link osu\`.`,
                );
            }

            throw new Exception(
                EApplicationError.INPUT_ERROR,
                `<@${userID}> hasn't linked an account on ${ProviderMeta[server].name}.`,
            );
        }

        return linked.osuID;
    }

    public getHelpContext(): Record<string, string> {
        return {
            mode: ProfileFormatter.mode(this.forcedMode ?? GameMode.Standard),
        };
    }
}
