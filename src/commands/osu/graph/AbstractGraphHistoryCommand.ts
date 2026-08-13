import { Category, Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { GraphHistoryService } from "@/modules/osu/graph/GraphHistory.service";
import { ECommandCategory } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { AttachmentBuilder } from "discord.js";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";

@Category(ECommandCategory.Osu)
export abstract class AbstractGraphHistoryCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly graphHistoryService: GraphHistoryService;
    @Import() declare private readonly profileViewService: ProfileViewService;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const user = await this.osuService.user(target.query, target.mode, target.server);

        if (!user.monthlyPlaycounts?.length) {
            throw new Exception(EApplicationError.NOT_FOUND, "This user has no monthly playcount history.");
        }

        const graph = await this.graphHistoryService.generate(user.monthlyPlaycounts);
        const filename = `graph-history-${user.id}.png`;
        const embed = this.profileViewService.createBaseEmbed(user, Date.now(), false);

        embed.setThumbnail(null).setTitle("Playcount history").setImage(`attachment://${filename}`);

        await ctx.respond({
            embeds: [embed],
            files: [new AttachmentBuilder(graph, { name: filename })],
        });
    }
}
