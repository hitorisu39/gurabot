import { TRepository } from "@/core";
import { AbstractService } from "@/core/framework/AbstractService";
import {
    getOrCreateOrdrConfigQuery,
    getOrCreateOrdrUserQuery,
    getSaveOrdrConfigQuery,
} from "@/modules/ordr/queries/OrdrConfig.queries";
import { createDefaultOrdrSettings } from "@domain/ordr/configs/Ordr.config";
import { EOrdrConfigSource, OrdrConfigDto, OrdrSettingsDto } from "@domain/ordr/OrdrConfig.dto";
import { plainToInstance } from "class-transformer";

interface IOrdrConfigRecord {
    userID: string;
    source: string;
    settings: unknown;
    createdAt: Date;
    updatedAt: Date;
}

export class OrdrConfigService extends AbstractService {
    public defaults(): OrdrSettingsDto {
        return createDefaultOrdrSettings(this.config.ordr.defaultSkin);
    }

    public async getOrCreate(userID: string, repository?: TRepository): Promise<OrdrConfigDto> {
        const cb = async (repo: TRepository): Promise<OrdrConfigDto> => {
            await repo.user.upsert(getOrCreateOrdrUserQuery(userID));

            const config = await repo.ordrConfig.upsert(getOrCreateOrdrConfigQuery(userID, this.defaults()));
            return this.toDto(config);
        };

        return repository ? cb(repository) : this.repository.$transaction(cb);
    }

    public async save(
        userID: string,
        source: EOrdrConfigSource,
        settings: OrdrSettingsDto,
        repository?: TRepository,
    ): Promise<OrdrConfigDto> {
        const cb = async (repo: TRepository): Promise<OrdrConfigDto> => {
            await repo.user.upsert(getOrCreateOrdrUserQuery(userID));

            const config = await repo.ordrConfig.upsert(getSaveOrdrConfigQuery(userID, source, settings));
            return this.toDto(config);
        };

        return repository ? cb(repository) : this.repository.$transaction(cb);
    }

    private toDto(config: IOrdrConfigRecord): OrdrConfigDto {
        return plainToInstance(OrdrConfigDto, {
            userID: config.userID,
            source: this.parseSource(config.source),
            settings: this.parseSettings(config.settings),
            createdAt: config.createdAt,
            updatedAt: config.updatedAt,
        });
    }

    private parseSettings(value: unknown): OrdrSettingsDto {
        const stored = this.isRecord(value) ? value : {};

        return plainToInstance(OrdrSettingsDto, {
            ...this.defaults(),
            ...stored,
        });
    }

    private parseSource(value: string): EOrdrConfigSource {
        return value === EOrdrConfigSource.Preset ? EOrdrConfigSource.Preset : EOrdrConfigSource.Bot;
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return value !== null && typeof value === "object" && !Array.isArray(value);
    }
}
