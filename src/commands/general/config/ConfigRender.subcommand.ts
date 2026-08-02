import { AbstractSessionCommand } from "@/commands/AbstractSessionCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { Import, Subcommand } from "@/core/decorators";
import { OrdrService } from "@/modules/ordr/Ordr.service";
import { OrdrConfigService } from "@/modules/ordr/OrdrConfig.service";
import { OrdrConfigDto } from "@domain/ordr/OrdrConfig.dto";
import { EOrdrConfigView, OrdrConfigViewDto } from "@domain/ordr/views/OrdrConfig.view";
import { plainToInstance } from "class-transformer";
import { OrdrConfigViewService } from "@/modules/ordr/OrdrConfigView.service";

@Subcommand({
    root: "config",
    name: "render",
    description: "Configure your o!rdr render defaults.",
    ephemeral: true,
})
export class ConfigRenderSubcommand extends AbstractSessionCommand {
    @Import() declare private readonly ordrService: OrdrService;
    @Import() declare private readonly ordrConfigService: OrdrConfigService;
    @Import() declare private readonly ordrConfigViewService: OrdrConfigViewService;

    public async execute(ctx: CommandContext): Promise<void> {
        const [config, preset] = await Promise.all([
            this.ordrConfigService.getOrCreate(ctx.author.id),
            this.ordrService.preset(ctx.author.id),
        ]);

        const data = plainToInstance(OrdrConfigViewDto, {
            authorID: ctx.author.id,
            view: EOrdrConfigView.Overview,
            original: config,
            draft: this.clone(config),
            preset,
        });

        await this.respondWithSession(ctx, "ordr_config_view", data, this.ordrConfigViewService);
    }

    private clone(config: OrdrConfigDto): OrdrConfigDto {
        return plainToInstance(OrdrConfigDto, structuredClone(config));
    }
}
