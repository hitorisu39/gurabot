import { TRepository } from "@/core";
import { AbstractService } from "@/core/framework/AbstractService";
import { GuildConfigUpdateDto, GuildDto } from "@domain/guild/Guild.dto";
import { plainToInstance } from "class-transformer";

export class GuildService extends AbstractService {
    /**
     * Cache TTL for guild data (5 minutes).
     */
    private readonly cacheTtl: number = 300;

    /**
     * The amount of guilds per batch to load into cache on startup.
     */
    private readonly batchSize: number = 10000;

    public async init(): Promise<void> {
        this.logger.info("Initializing Guild Prefixes into Redis...");

        let cursor = "";
        let totalLoaded = 0;

        while (true) {
            const guilds = await this.repository.guild.findMany({
                select: { id: true, prefix: true },
                take: this.batchSize,
                ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            });

            if (guilds.length === 0) break;

            const batch: Record<string, string> = {};
            for (const guild of guilds) {
                if (guild.prefix) batch[guild.id] = guild.prefix;
            }

            await this.cache.hSetMulti("guild_prefix", batch);
            totalLoaded += Object.keys(batch).length;

            cursor = guilds[guilds.length - 1]!.id;
        }

        this.logger.info(`Loaded ${totalLoaded} custom guild prefixes into cache.`);
    }

    //#region API

    public async get(guildID?: string | null): Promise<GuildDto | null> {
        if (!guildID) return null;

        const cachedGuild = await this.cache.get("guild", guildID);
        if (cachedGuild) return plainToInstance(GuildDto, cachedGuild);

        const guild = await this.repository.guild.findUnique({ where: { id: guildID } });
        if (!guild) return null;

        const dto = plainToInstance(GuildDto, guild);
        return this.refreshCache(guildID, dto);
    }

    public async getPrefix(guildID: string | null): Promise<string> {
        if (!guildID) return this.config.app.prefix;

        const cached = await this.cache.hGet("guild_prefix", guildID);
        if (cached) return cached;

        const guild = await this.get(guildID);
        return guild?.prefix ?? this.config.app.prefix;
    }

    public async update(guildID: string, updates: GuildConfigUpdateDto, repository?: TRepository): Promise<GuildDto> {
        const cb = async (repo: TRepository) => {
            const guild = await repo.guild.upsert({
                where: { id: guildID },
                create: { id: guildID, ...updates },
                update: { ...updates },
            });

            const dto = plainToInstance(GuildDto, guild);
            return this.refreshCache(guildID, dto);
        };

        return repository ? cb(repository) : this.repository.$transaction(cb);
    }

    //#endregion

    //#region Internal

    private async refreshCache(guildID: string, data: GuildDto): Promise<GuildDto> {
        const tasks: Array<Promise<void>> = [this.cache.set("guild", data, this.cacheTtl, guildID)];

        if (data.prefix) {
            tasks.push(this.cache.hSet("guild_prefix", guildID, data.prefix));
        } else {
            tasks.push(this.cache.hDel("guild_prefix", guildID));
        }

        await Promise.all(tasks);
        return data;
    }

    //#endregion
}
