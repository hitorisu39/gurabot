import { Category, Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { GraphRankService } from "@/modules/osu/graph/GraphRank.service";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { ECommandCategory } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { AttachmentBuilder } from "discord.js";

@Category(ECommandCategory.Osu)
export abstract class AbstractGraphRankCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly graphRankService: GraphRankService;
    @Import() declare private readonly profileViewService: ProfileViewService;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const timestamp = Date.now();

        const profile = await this.osuService.user(target.query, target.mode, target.server);

        if (!profile.rankHistory?.data?.length) {
            throw new Exception(EApplicationError.NOT_FOUND, "This user has no rank history.");
        }

        const image = await this.graphRankService.render(profile.rankHistory.data, timestamp);
        const filename = `rank-history-${profile.id}.png`;
        const embed = this.profileViewService.createBaseEmbed(profile, timestamp, false);

        embed.setThumbnail(null).setTitle("Rank history").setImage(`attachment://${filename}`);

        await ctx.respond({
            embeds: [embed],
            files: [
                new AttachmentBuilder(image, {
                    name: filename,
                }),
            ],
        });
    }
}
