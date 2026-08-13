import { Category, Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractOsuCommand } from "@/commands/osu/AbstractOsuCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { OsuTrackService } from "@/modules/osutrack/OsuTrack.service";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { ECommandCategory } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { OsuTrackStatsHistoryDto } from "@domain/osutrack/OsuTrack.dto";
import { AdapterProvider } from "@generated/adapter/types";
import { AttachmentBuilder } from "discord.js";

export interface IGraphOsuTrackResult {
    image: Buffer;
    filename: string;
    title: string;
}

@Category(ECommandCategory.Osu)
export abstract class AbstractGraphOsuTrackCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly osuTrackService: OsuTrackService;
    @Import() declare private readonly profileViewService: ProfileViewService;

    protected abstract generateGraph(history: ReadonlyArray<OsuTrackStatsHistoryDto>): Promise<IGraphOsuTrackResult>;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const timestamp = Date.now();

        if (target.server !== AdapterProvider.Bancho) {
            throw new Exception(EApplicationError.NOT_FOUND, "osu!track graphs are only available for Bancho users.");
        }

        const profile = await this.osuService.user(target.query, target.mode, target.server);
        const history = await this.osuTrackService.history(profile.id, target.mode, target.server);

        if (!history.length) {
            throw new Exception(EApplicationError.NOT_FOUND, "This user has no osu!track history.");
        }

        const graph = await this.generateGraph(history);
        const filename = `${graph.filename}-${profile.id}-${target.mode}.png`;
        const embed = this.profileViewService.createBaseEmbed(profile, timestamp, false);

        embed.setThumbnail(null).setTitle(graph.title).setImage(`attachment://${filename}`);

        await ctx.respond({
            embeds: [embed],
            files: [
                new AttachmentBuilder(graph.image, {
                    name: filename,
                }),
            ],
        });
    }
}
