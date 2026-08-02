import { AbstractService } from "@/core/framework/AbstractService";
import {
    getCreateOrdrRenderQuery,
    getLatestOrdrRenderQuery,
    getRecentOrdrSkinsQuery,
} from "@/modules/ordr/queries/OrdrRender.queries";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { OrdrConfigDto } from "@domain/ordr/OrdrConfig.dto";

export interface IRecentOrdrSkin {
    skin: string;
    customSkin: boolean;
}

export class OrdrRenderService extends AbstractService {
    private readonly cooldown = 5 * 60 * 1_000;

    /**
     * Prevents multiple confirmation buttons from being submitted at the same
     * time in this process.
     */
    private readonly submissions = new Set<string>();

    /**
     * Immediate in-process fallback in case persistence fails after o!rdr has
     * already accepted the render.
     */
    private readonly acceptedAt = new Map<string, number>();

    public async cooldownRemaining(userID: string): Promise<number> {
        const now = Date.now();
        const localSubmittedAt = this.acceptedAt.get(userID);

        if (localSubmittedAt !== undefined && localSubmittedAt + this.cooldown <= now) {
            this.acceptedAt.delete(userID);
        }

        const after = new Date(now - this.cooldown);
        const persisted = await this.repository.ordrRender.findFirst(getLatestOrdrRenderQuery(userID, after));

        const persistedSubmittedAt = persisted?.createdAt.getTime() ?? 0;
        const effectiveSubmittedAt = Math.max(this.acceptedAt.get(userID) ?? 0, persistedSubmittedAt);

        return Math.max(0, effectiveSubmittedAt + this.cooldown - now);
    }

    /**
     * Called only after POST /ordr/renders has returned a render ID.
     */
    public async record(userID: string, renderID: number, config: OrdrConfigDto): Promise<void> {
        this.acceptedAt.set(userID, Date.now());

        try {
            await this.repository.ordrRender.create(getCreateOrdrRenderQuery(userID, renderID, config));
        } catch (error) {
            /*
             * The render already exists remotely, so persistence failure must
             * not prevent websocket tracking.
             */
            this.logger.error({ error, userID, renderID }, "Failed to persist accepted o!rdr render");
        }
    }

    public async recentSkins(userID: string, limit: number = 5): Promise<Array<IRecentOrdrSkin>> {
        const renders = await this.repository.ordrRender.findMany(getRecentOrdrSkinsQuery(userID));

        const skins: Array<IRecentOrdrSkin> = [];
        const seen = new Set<string>();

        for (const render of renders) {
            if (!render.skin || render.customSkin === null) continue;

            const key = `${render.customSkin}:${render.skin}`;
            if (seen.has(key)) continue;

            seen.add(key);
            skins.push({
                skin: render.skin,
                customSkin: render.customSkin,
            });

            if (skins.length >= limit) break;
        }

        return skins;
    }

    public async withSubmissionLock<T>(userID: string, callback: () => Promise<T>): Promise<T> {
        if (this.submissions.has(userID)) {
            throw new Exception(EApplicationError.INPUT_ERROR, "A render request is already being submitted.");
        }

        this.submissions.add(userID);

        try {
            return await callback();
        } finally {
            this.submissions.delete(userID);
        }
    }
}
