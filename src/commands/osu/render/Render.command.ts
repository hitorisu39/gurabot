import { AbstractSessionCommand } from "@/commands/AbstractSessionCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { Category, Command, Import, Inject, IsAttachment, IsString, NoUserInstall, Option } from "@/core/decorators";
import { OrdrService } from "@/modules/ordr/Ordr.service";
import { OrdrConfigService } from "@/modules/ordr/OrdrConfig.service";
import { OrdrRenderService } from "@/modules/ordr/OrdrRender.service";
import { OrdrRenderViewService } from "@/modules/ordr/OrdrRenderView.service";
import { CommandOption, ECommandCategory } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { OrdrReplayFileDto } from "@domain/ordr/Ordr.dto";

import { Attachment } from "discord.js";
import { plainToInstance } from "class-transformer";
import { ScoreResolverService } from "@/modules/osu/ScoreResolver.service";
import { OrdrScoreRenderService } from "@/modules/ordr/OrdrScoreRender.service";
import { OrdrRenderResolverService } from "@/modules/ordr/OrdrRenderResolver.service";

@Category(ECommandCategory.Osu)
@Command({
    name: "render",
    description: "Renders an osu! replay or score using o!rdr.",
    aliases: ["upload"],
})
@NoUserInstall()
export class RenderCommand extends AbstractSessionCommand {
    @Import() declare private readonly ordrService: OrdrService;
    @Import() declare private readonly ordrConfigService: OrdrConfigService;
    @Import() declare private readonly ordrRenderService: OrdrRenderService;
    @Import() declare private readonly ordrRenderViewService: OrdrRenderViewService;
    @Import() declare private readonly ordrScoreRenderService: OrdrScoreRenderService;
    @Import() declare private readonly ordrRenderResolverService: OrdrRenderResolverService;
    @Import() declare private readonly scoreResolverService: ScoreResolverService;

    @Option("replay", "Upload an osu! replay file.")
    @IsAttachment()
    declare private readonly replay: CommandOption<Attachment>;

    @Option("score", "Specify an osu! score URL or ID.")
    @IsString()
    @Inject()
    declare private readonly score: CommandOption<string>;

    public async execute(ctx: CommandContext): Promise<void> {
        const hasReplay = this.replay.some();
        const hasExplicitScore = this.score.some();

        if (hasReplay && hasExplicitScore) {
            throw new Exception(
                EApplicationError.INPUT_ERROR,
                "Provide either a replay attachment or a score, not both.",
            );
        }

        if (hasReplay) {
            await this.executeReplay(ctx, this.replay.unwrap());
            return;
        }

        await this.executeScore(ctx);
    }

    private async executeReplay(ctx: CommandContext, attachment: Attachment): Promise<void> {
        const replay = this.resolveReplay(attachment);
        const data = await this.ordrRenderResolverService.replay(ctx.author.id, replay);
        await this.respondWithSession(ctx, "ordr_render_view", data, this.ordrRenderViewService);
    }

    private async executeScore(ctx: CommandContext): Promise<void> {
        const scoreID = await this.scoreResolverService.resolveCommandTarget(ctx, this.score);
        const data = await this.ordrRenderResolverService.score(ctx.author.id, scoreID);
        await this.respondWithSession(ctx, "ordr_render_view", data, this.ordrRenderViewService);
    }

    private resolveReplay(attachment: Attachment): OrdrReplayFileDto {
        if (!attachment.name.toLowerCase().endsWith(".osr")) {
            throw new Exception(EApplicationError.INPUT_ERROR, "The replay attachment must be an `.osr` file.");
        }

        if (attachment.size <= 0) {
            throw new Exception(EApplicationError.INPUT_ERROR, "The replay attachment is empty.");
        }

        return plainToInstance(OrdrReplayFileDto, {
            name: attachment.name,
            url: attachment.url,
            size: attachment.size,
            contentType: attachment.contentType,
        });
    }
}
