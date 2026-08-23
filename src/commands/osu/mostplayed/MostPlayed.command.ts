import { Category, Command, Examples, Help, Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { OsuService } from "@/modules/osu/Osu.service";
import { ECommandCategory } from "@domain/core/Command";
import { MostPlayedViewDto } from "@domain/osu/views/MostPlayed.view";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { MostPlayedViewService } from "@/modules/osu/mostplayed/MostPlayedView.service";

@Help("Shows the 100 most played beatmaps of the specified osu! player.")
@Examples("mostplayed mrekk", "mp mrekk")
@Category(ECommandCategory.Osu)
@Command({
    name: "mostplayed",
    description: "Shows a player's most played beatmaps.",
    aliases: ["mp"],
})
export class MostPlayedCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly mostPlayedViewService: MostPlayedViewService;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);

        const profile = await this.osuService.user(target.query, target.mode, target.server);
        const beatmaps = await this.osuService.mostPlayed(profile.id, { limit: 100 }, target.server);
        const complete = beatmaps.filter((entry) => entry.beatmap && entry.beatmapset);

        const data: MostPlayedViewDto = {
            authorID: ctx.author.id,
            timestamp: Date.now(),
            profile,
            beatmaps: complete,
            page: 1,
        };

        await this.respondWithSession(ctx, "osu_most_played_view", data, this.mostPlayedViewService);
    }
}
