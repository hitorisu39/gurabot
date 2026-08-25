import { AbstractSessionCommand } from "@/commands/AbstractSessionCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { Category, Command, Import, Inject, IsAttachment, IsString, NoUserInstall, Option } from "@/core/decorators";
import { OrdrService } from "@/modules/ordr/Ordr.service";
import { OrdrConfigService } from "@/modules/ordr/OrdrConfig.service";
import { IRecentOrdrSkin, OrdrRenderService } from "@/modules/ordr/OrdrRender.service";
import { OrdrRenderViewService } from "@/modules/ordr/OrdrRenderView.service";
import { CommandOption, ECommandCategory } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { OrdrReplayFileDto } from "@domain/ordr/Ordr.dto";
import { EOrdrConfigSource, OrdrConfigDto } from "@domain/ordr/OrdrConfig.dto";
import {
    EOrdrRenderInput,
    EOrdrRenderStage,
    OrdrRenderViewDto,
    OrdrSkinChoiceDto,
} from "@domain/ordr/views/OrdrRender.view";
import { Attachment } from "discord.js";
import { plainToInstance } from "class-transformer";
import { ScoreResolverService } from "@/modules/osu/ScoreResolver.service";
import { OrdrScoreRenderService } from "@/modules/ordr/OrdrScoreRender.service";

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
        const base = await this.loadConfiguration(ctx.author.id);

        const data: OrdrRenderViewDto = {
            authorID: ctx.author.id,
            input: EOrdrRenderInput.Replay,
            replay,
            ...base,
            stage: EOrdrRenderStage.Confirmation,
        };

        await this.respondWithSession(ctx, "ordr_render_view", data, this.ordrRenderViewService);
    }

    private async executeScore(ctx: CommandContext): Promise<void> {
        const scoreID = await this.scoreResolverService.resolveCommandTarget(ctx, this.score);
        const cached = await this.ordrScoreRenderService.cached(scoreID);
        const base = await this.loadConfiguration(ctx.author.id);

        if (cached) {
            const data: OrdrRenderViewDto = {
                authorID: ctx.author.id,
                input: EOrdrRenderInput.Score,
                scoreID,
                cachedRenderID: cached.renderID,
                cachedVideoURL: cached.videoURL,
                ...base,
                stage: EOrdrRenderStage.Cached,
            };

            await this.respondWithSession(ctx, "ordr_render_view", data, this.ordrRenderViewService);
            return;
        }

        const score = await this.ordrScoreRenderService.resolve(scoreID);
        const data: OrdrRenderViewDto = {
            authorID: ctx.author.id,
            input: EOrdrRenderInput.Score,
            scoreID,
            score,
            ...base,
            stage: EOrdrRenderStage.Confirmation,
        };

        await this.respondWithSession(ctx, "ordr_render_view", data, this.ordrRenderViewService);
    }

    private async loadConfiguration(userID: string): Promise<Pick<OrdrRenderViewDto, "config" | "preset" | "skins">> {
        const presetPromise =
            this.config.app.mode === "production" ? this.ordrService.preset(userID) : Promise.resolve(null);

        const [storedConfig, preset, recentSkins] = await Promise.all([
            this.ordrConfigService.getOrCreate(userID),
            presetPromise,
            this.ordrRenderService.recentSkins(userID),
        ]);

        const config = this.cloneConfig(storedConfig);
        if (!preset && config.source === EOrdrConfigSource.Preset) {
            config.source = EOrdrConfigSource.Bot;
        }

        const skins = await this.buildSkinChoices(config, recentSkins);
        return {
            config,
            preset,
            skins,
        };
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

    private async buildSkinChoices(
        config: OrdrConfigDto,
        recentSkins: Array<IRecentOrdrSkin>,
    ): Promise<Array<OrdrSkinChoiceDto>> {
        const choices: Array<OrdrSkinChoiceDto> = [];
        const seen = new Set<string>();

        if (config.source === EOrdrConfigSource.Bot) {
            const current = await this.createSkinChoice(
                {
                    skin: config.settings.skin,
                    customSkin: config.settings.customSkin,
                },
                true,
            );

            config.settings.skin = current.skin;
            config.settings.customSkin = current.customSkin;

            choices.push(current);
            seen.add(`${current.customSkin}:${current.skin}`);
        }

        for (const recent of recentSkins) {
            if (choices.length >= 5) break;

            const choice = await this.createSkinChoice(recent, false);
            if (!choice) continue;

            const key = `${choice.customSkin}:${choice.skin}`;
            if (seen.has(key)) continue;

            seen.add(key);
            choices.push(choice);
        }

        return choices;
    }

    private async createSkinChoice(skin: IRecentOrdrSkin, required: true): Promise<OrdrSkinChoiceDto>;
    private async createSkinChoice(skin: IRecentOrdrSkin, required: false): Promise<OrdrSkinChoiceDto | null>;
    private async createSkinChoice(skin: IRecentOrdrSkin, required: boolean): Promise<OrdrSkinChoiceDto | null> {
        if (!skin.customSkin) {
            return plainToInstance(OrdrSkinChoiceDto, {
                skin: skin.skin,
                customSkin: false,
                label: skin.skin,
                description: `Official skin • ${skin.skin}`,
            });
        }

        const id = Number(skin.skin);
        const info = Number.isInteger(id) ? await this.ordrService.customSkin(id).catch(() => null) : null;

        if (!info) {
            if (!required) return null;

            throw new Exception(EApplicationError.INPUT_ERROR, "Your configured custom skin no longer exists.");
        }

        return plainToInstance(OrdrSkinChoiceDto, {
            skin: id.toString(),
            customSkin: true,
            label: info.skinName,
            description: `Custom #${id} by ${info.skinAuthor}`,
        });
    }

    private cloneConfig(config: OrdrConfigDto): OrdrConfigDto {
        return plainToInstance(OrdrConfigDto, structuredClone(config));
    }
}
