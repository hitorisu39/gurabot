import { EApplicationError, Exception } from "@domain/core/Exception";
import { GuildOnly, Import, IsEnum, IsString, Option, Subcommand, UserPermissions } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { GuildService } from "@/modules/guild/Guild.service";
import { discordRegexSpecialCharacters } from "@domain/discord/configs/Discord.config";
import { PermissionFlagsBits } from "discord.js";
import { CommandOption } from "@domain/core/Command";
import { EScoreListSize } from "@domain/osu/enums/Score.enum";
import { GuildConfigUpdateDto } from "@domain/guild/Guild.dto";
import { AdapterProvider, GameMode } from "@generated/adapter/types";

@Subcommand({
    root: "config",
    name: "guild",
    description: "Configuration for your guild.",
    ephemeral: true,
})
@GuildOnly()
@UserPermissions(PermissionFlagsBits.ManageChannels)
export class ConfigGuildSubcommand extends AbstractCommand {
    @Import() declare private readonly guildService: GuildService;

    @Option("prefix", "Specify the prefix to utilize for message commands.")
    @IsString(1, 3)
    declare private readonly prefix: CommandOption<string>;

    @Option("mode", "Specify your default osu! game mode.")
    @IsEnum(GameMode)
    declare private readonly mode: CommandOption<GameMode>;

    @Option("server", "Specify your default osu! server.")
    @IsEnum(AdapterProvider)
    declare private readonly server: CommandOption<AdapterProvider>;

    @Option("score_list_size", "Specify the default size for score lists (detailed/compact).")
    @IsEnum(EScoreListSize)
    declare private readonly scoreListSize: CommandOption<EScoreListSize>;

    public async execute(ctx: CommandContext): Promise<void> {
        if (!ctx.guild)
            throw new Exception(EApplicationError.INPUT_ERROR, "This command is only available to be used in guilds.");

        const updates: GuildConfigUpdateDto = {};

        if (this.prefix.some()) {
            const newPrefix = this.prefix.unwrap();
            if (!discordRegexSpecialCharacters.test(newPrefix))
                throw new Exception(
                    EApplicationError.INPUT_ERROR,
                    "Prefix must contain at least one special character: `! > < ? | \\ / ^ @ # $ % & *`",
                );

            updates.prefix = newPrefix;
        }

        if (this.scoreListSize.some()) updates.scoreListSize = this.scoreListSize.unwrap();
        if (this.server.some()) updates.server = this.server.unwrap();
        if (this.mode.some()) updates.mode = this.mode.unwrap();

        await this.guildService.update(ctx.guild.id, updates);
        await ctx.respond(Embed.success("The guild configuration was updated."));
    }
}
