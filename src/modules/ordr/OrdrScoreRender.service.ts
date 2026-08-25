import { Import } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { OsuService } from "@/modules/osu/Osu.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ScoreFormatter } from "@domain/osu/formatters/Score.formatter";
import { OrdrRenderScoreDto } from "@domain/ordr/views/OrdrRender.view";
import { AdapterProvider } from "@generated/adapter/types";
import { plainToInstance } from "class-transformer";
import { OrdrCachedScoreDto } from "@domain/ordr/Ordr.dto";
import { TRepository } from "@/core";

export class OrdrScoreRenderService extends AbstractService {
    @Import() declare private readonly osuService: OsuService;

    private readonly renderCacheTtl = 30 * 24 * 60 * 60 * 1_000;

    /**
     * waitForRender() currently times out after 30 minutes.
     * The extra margin ensures the lock remains while an ordinary
     * o!rdr job is still running.
     */
    private readonly renderLockTtl = 45 * 60 * 1_000;

    public async cached(scoreID: string, repository?: TRepository): Promise<OrdrCachedScoreDto | null> {
        const cb = async (repo: TRepository) => {
            const render = await repo.ordrScoreRender.findUnique({ where: { scoreID } });
            if (!render) {
                return null;
            }

            const expired = render.createdAt.getTime() + this.renderCacheTtl <= Date.now();
            if (!expired) {
                return plainToInstance(OrdrCachedScoreDto, render);
            }

            await repo.ordrScoreRender.delete({ where: { scoreID } }).catch(() => undefined);
            return null;
        };

        return cb(repository ?? this.repository);
    }

    public async record(scoreID: string, renderID: number, videoURL: string, repository?: TRepository): Promise<void> {
        const cb = async (repo: TRepository) => {
            const renderedAt = new Date();
            await repo.ordrScoreRender.upsert({
                where: {
                    scoreID,
                },
                create: {
                    scoreID,
                    renderID,
                    videoURL,
                    createdAt: renderedAt,
                },
                update: {
                    renderID,
                    videoURL,
                    createdAt: renderedAt,
                },
            });
        };

        return repository ? cb(repository) : this.repository.$transaction(cb);
    }

    public async resolve(scoreID: string): Promise<OrdrRenderScoreDto> {
        const score = await this.osuService.score(scoreID, AdapterProvider.Bancho);

        if (!score.replay) {
            throw new Exception(EApplicationError.INPUT_ERROR, "This score does not have a replay available.");
        }

        let beatmap = score.beatmap;
        let beatmapset = score.beatmapset ?? score.beatmap?.beatmapset;

        if (!beatmap || !beatmapset) {
            const populated = await this.osuService.populateMaps([score], AdapterProvider.Bancho);
            const resolved = populated[0];

            if (!resolved) {
                throw new Exception(EApplicationError.NOT_FOUND, "Could not resolve the score's beatmap.");
            }

            beatmap = resolved.beatmap;
            beatmapset = resolved.beatmapset;
        }

        const user = score.user ?? (await this.osuService.user(score.userID, beatmap.mode, AdapterProvider.Bancho));

        return plainToInstance(OrdrRenderScoreDto, {
            id: scoreID,

            userID: score.userID,
            username: user.username,

            beatmapID: beatmap.id,
            beatmapsetID: beatmap.beatmapsetID,

            artist: beatmapset.artist,
            title: beatmapset.title,
            version: beatmap.version,
            mode: beatmap.mode,

            mods: ScoreFormatter.mods(score.mods),

            accuracy: score.accuracy,
            pp: score.pp,
            maxCombo: score.maxCombo,
            endedAt: score.endedAt,
        });
    }

    public async acquireLock(scoreID: string): Promise<string | null> {
        return this.cache.acquireLock(this.lockKey(scoreID), this.renderLockTtl);
    }

    public async releaseLock(scoreID: string, token: string): Promise<void> {
        await this.cache.releaseLock(this.lockKey(scoreID), token);
    }

    private lockKey(scoreID: string): string {
        return `ordr:score-render:${scoreID}`;
    }
}
