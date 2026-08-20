import { Autocomplete, Import, Inject, IsString, Option, Required } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { CommandOption } from "@domain/core/Command";
import { AutocompleteContext } from "@/core/discord/context/AutocompleteContext";
import { MedalInfoViewService } from "@/modules/osu/medal/MedalInfoView.service";
import { MedalInfoViewDto } from "@domain/osu/views/MedalInfo.view";
import { GuildService } from "@/modules/guild/Guild.service";
import { OsekaiService } from "@/modules/osekai/Osekai.service";

export abstract class AbstractMedalInfoCommand extends AbstractCommand {
    @Import() declare private readonly osekaiService: OsekaiService;
    @Import() declare private readonly medalInfoViewService: MedalInfoViewService;
    @Import() declare private readonly guildService: GuildService;

    @Option("name", "Specify medal name")
    @IsString(1, 128)
    @Autocomplete()
    @Inject()
    @Required()
    declare private readonly name: CommandOption<string>;

    public async execute(ctx: CommandContext): Promise<void> {
        const medal = await this.osekaiService.medal(this.name.unwrap());
        const guild = await this.guildService.get(ctx.guild?.id);

        const [beatmapsResult, commentsResult] = await Promise.allSettled([
            this.osekaiService.medalBeatmaps(medal.id),
            this.osekaiService.medalComments(medal.id, 2),
        ]);

        const data: MedalInfoViewDto = {
            medal,
            beatmaps: beatmapsResult.status === "fulfilled" ? beatmapsResult.value : [],
            comments: commentsResult.status === "fulfilled" ? commentsResult.value : [],
            spoil: guild?.spoilMedals ?? true,
        };

        await ctx.respond(this.medalInfoViewService.build(data));
    }

    public async autocomplete(ctx: AutocompleteContext): Promise<void> {
        const focused = ctx.getFocused();
        if (focused.name !== "name") return await ctx.respond([]);

        const medals = await this.osekaiService.searchMedal(String(focused.value));

        await ctx.respond(
            medals.map((medal) => ({
                name: medal.name,
                value: medal.name,
            })),
        );
    }
}
