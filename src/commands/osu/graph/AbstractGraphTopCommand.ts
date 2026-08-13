import { Category, Import } from "@/core/decorators";
import { AbstractOsuCommand } from "@/commands/osu/AbstractOsuCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { OsuService } from "@/modules/osu/Osu.service";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { ECommandCategory } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { Score } from "@generated/adapter/types";
import { AttachmentBuilder } from "discord.js";

export interface IGraphTopResult {
    image: Buffer;
    filename: string;
    title: string;
}

@Category(ECommandCategory.Osu)
export abstract class AbstractGraphTopCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly profileViewService: ProfileViewService;

    protected readonly requiresMaps: boolean = false;

    protected abstract generateGraph(scores: ReadonlyArray<Score>): Promise<IGraphTopResult>;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const timestamp = Date.now();

        const { user, scores } = await this.osuService.userWithScores({
            nameOrID: target.query,
            mode: target.mode,
            type: "best",
            limit: 100,
            provider: target.server,
        });

        if (!scores.length) {
            throw new Exception(EApplicationError.NOT_FOUND, "This user has no top plays.");
        }

        const graphScores = this.requiresMaps ? await this.osuService.populateMaps(scores, target.server) : scores;
        if (!graphScores.length) {
            throw new Exception(
                EApplicationError.NOT_FOUND,
                "Could not retrieve beatmap data for this user's top plays.",
            );
        }

        const graph = await this.generateGraph(graphScores);
        const filename = `${graph.filename}-${user.id}.png`;
        const embed = this.profileViewService.createBaseEmbed(user, timestamp, false);

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
