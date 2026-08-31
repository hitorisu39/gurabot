import { Import } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { OrdrService } from "@/modules/ordr/Ordr.service";
import { OrdrConfigService } from "@/modules/ordr/OrdrConfig.service";
import { IRecentOrdrSkin, OrdrRenderService } from "@/modules/ordr/OrdrRender.service";
import { OrdrScoreRenderService } from "@/modules/ordr/OrdrScoreRender.service";
import { OrdrReplayFileDto } from "@domain/ordr/Ordr.dto";
import { EOrdrConfigSource, OrdrConfigDto } from "@domain/ordr/OrdrConfig.dto";
import {
    EOrdrRenderInput,
    EOrdrRenderStage,
    OrdrRenderViewDto,
    OrdrSkinChoiceDto,
} from "@domain/ordr/views/OrdrRender.view";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { plainToInstance } from "class-transformer";

export class OrdrRenderResolverService extends AbstractService {
    @Import() declare private readonly ordrService: OrdrService;
    @Import() declare private readonly ordrConfigService: OrdrConfigService;
    @Import() declare private readonly ordrRenderService: OrdrRenderService;
    @Import() declare private readonly ordrScoreRenderService: OrdrScoreRenderService;

    public async score(userID: string, scoreID: string): Promise<OrdrRenderViewDto> {
        const [cached, base] = await Promise.all([
            this.ordrScoreRenderService.cached(scoreID),
            this.resolveConfiguration(userID),
        ]);

        if (cached) {
            return {
                authorID: userID,
                input: EOrdrRenderInput.Score,
                scoreID,
                cachedRenderID: cached.renderID,
                cachedVideoURL: cached.videoURL,
                ...base,
                stage: EOrdrRenderStage.Cached,
            };
        }

        const score = await this.ordrScoreRenderService.resolve(scoreID);

        return {
            authorID: userID,
            input: EOrdrRenderInput.Score,
            scoreID,
            score,
            ...base,
            stage: EOrdrRenderStage.Confirmation,
        };
    }

    public async replay(userID: string, replay: OrdrReplayFileDto): Promise<OrdrRenderViewDto> {
        return {
            authorID: userID,
            input: EOrdrRenderInput.Replay,
            replay,
            ...(await this.resolveConfiguration(userID)),
            stage: EOrdrRenderStage.Confirmation,
        };
    }

    private async resolveConfiguration(
        userID: string,
    ): Promise<Pick<OrdrRenderViewDto, "config" | "preset" | "skins">> {
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

        const skins = await this.resolveSkinChoices(config, recentSkins);
        return {
            config,
            preset,
            skins,
        };
    }

    private async resolveSkinChoices(
        config: OrdrConfigDto,
        recentSkins: Array<IRecentOrdrSkin>,
    ): Promise<Array<OrdrSkinChoiceDto>> {
        const choices: Array<OrdrSkinChoiceDto> = [];
        const seen = new Set<string>();

        if (config.source === EOrdrConfigSource.Bot) {
            const current = await this.resolveSkinChoice(
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

            const choice = await this.resolveSkinChoice(recent, false);
            if (!choice) continue;

            const key = `${choice.customSkin}:${choice.skin}`;
            if (seen.has(key)) continue;
            seen.add(key);

            choices.push(choice);
        }

        return choices;
    }

    private async resolveSkinChoice(skin: IRecentOrdrSkin, required: true): Promise<OrdrSkinChoiceDto>;
    private async resolveSkinChoice(skin: IRecentOrdrSkin, required: false): Promise<OrdrSkinChoiceDto | null>;
    private async resolveSkinChoice(skin: IRecentOrdrSkin, required: boolean): Promise<OrdrSkinChoiceDto | null> {
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
