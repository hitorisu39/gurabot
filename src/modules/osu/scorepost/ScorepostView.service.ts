import { AttachmentBuilder } from "discord.js";
import { Import, Trace } from "@/core/decorators";
import { TMessageFile, TMessagePayload } from "@/core/discord/context/CommandContext";
import { AbstractService } from "@/core/framework/AbstractService";
import { EScorepostClient } from "@domain/osu/enums/Scorepost.enum";
import { ScorepostViewDto } from "@domain/osu/views/Scorepost.view";
import { StableScorepostRendererService } from "./StableScorepostRenderer.service";
import { LazerScorepostRendererService } from "./LazerScorepostRenderer.service";
import { ScorepostFormatter } from "@domain/osu/formatters/Scorepost.formatter";
import { GameMode } from "@generated/adapter/types";

export class ScorepostViewService extends AbstractService {
    @Import() declare private readonly stableRenderer: StableScorepostRendererService;
    @Import() declare private readonly lazerRenderer: LazerScorepostRendererService;

    @Trace()
    public async build(data: ScorepostViewDto): Promise<TMessagePayload> {
        let files: Array<TMessageFile> = [];
        const content = "```" + ScorepostFormatter.text(data.user, data.score, data.text) + "```";

        if (data.score.mode === GameMode.Standard) {
            const image = await this.generate(data);
            const filename = `scorepost-${data.score.id}-${data.client}.jpg`;
            files = [new AttachmentBuilder(image, { name: filename })];
        }

        return { content, files };
    }

    private async generate(data: ScorepostViewDto): Promise<Buffer> {
        switch (data.client) {
            case EScorepostClient.Stable:
                return await this.stableRenderer.render(data);
            case EScorepostClient.Lazer:
                return await this.lazerRenderer.render(data);
        }
    }
}
