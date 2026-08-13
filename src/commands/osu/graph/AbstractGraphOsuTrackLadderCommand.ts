import { Category, Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractOsuCommand } from "@/commands/osu/AbstractOsuCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { OsuTrackLadderService } from "@/modules/osutrack/OsuTrackLadder.service";
import {
    GraphOsuTrackLadderService,
    IOsuTrackLadderGraphMarker,
} from "@/modules/osu/graph/GraphOsuTrackLadder.service";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { ECommandCategory } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { AdapterProvider } from "@generated/adapter/types";
import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { EOsuTrackLadderMetric } from "@domain/osutrack/enums/OsuTrackLadder.enum";
import { discordEmbedColorGeneral } from "@domain/discord/configs/Embed.config";

@Category(ECommandCategory.Osu)
export abstract class AbstractGraphOsuTrackLadderCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly osuTrackLadderService: OsuTrackLadderService;
    @Import() declare private readonly graphOsuTrackLadderService: GraphOsuTrackLadderService;
    @Import() declare private readonly profileViewService: ProfileViewService;

    protected abstract readonly metric: EOsuTrackLadderMetric;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveOptionalTarget(ctx);

        if (target.server !== AdapterProvider.Bancho) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                "osu!track ladder graphs are only available for Bancho users.",
            );
        }

        const timestamp = Date.now();

        const profile =
            target.query === null ? null : await this.osuService.user(target.query, target.mode, target.server);

        const config = await this.osuTrackLadderService.simulationConfig(target.mode, target.server);

        let marker: IOsuTrackLadderGraphMarker | undefined;
        if (profile) {
            marker = {
                username: profile.username,
                rank: profile.statistics.globalRank,
            };
        }

        const graph = await this.graphOsuTrackLadderService.generate(config, this.metric, marker);
        const filename = `${graph.filename}` + `-${target.mode}` + `${profile ? `-${profile.id}` : "-global"}` + `.png`;
        const title = `${ProfileFormatter.mode(target.mode)} ${graph.title}`;
        const embed = profile
            ? this.profileViewService.createBaseEmbed(profile, timestamp, false)
            : new EmbedBuilder().setColor(discordEmbedColorGeneral);

        embed.setThumbnail(null).setTitle(title).setImage(`attachment://${filename}`);

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
