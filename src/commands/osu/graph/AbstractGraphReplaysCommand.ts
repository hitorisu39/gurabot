import { Category, Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { GraphReplaysService } from "@/modules/osu/graph/GraphReplays.service";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { ECommandCategory } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { AttachmentBuilder } from "discord.js";

@Category(ECommandCategory.Osu)
export abstract class AbstractGraphReplaysCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly graphReplaysService: GraphReplaysService;
    @Import() declare private readonly profileViewService: ProfileViewService;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const timestamp = Date.now();

        const profile = await this.osuService.user(target.query, target.mode, target.server);

        if (!profile.replaysWatchedCounts?.length) {
            throw new Exception(EApplicationError.NOT_FOUND, "This user has no replays watched history.");
        }

        const image = await this.graphReplaysService.generate(profile.replaysWatchedCounts);
        const filename = `replays-watched-${profile.id}.png`;
        const embed = this.profileViewService.createBaseEmbed(profile, timestamp, false);

        embed.setThumbnail(null).setTitle("Replays watched").setImage(`attachment://${filename}`);

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
