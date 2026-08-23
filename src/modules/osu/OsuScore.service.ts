import { AbstractService } from "@/core/framework/AbstractService";
import { AdapterProvider, GameMode, Score } from "@generated/adapter/types";
import { ParsedMod } from "@generated/adapter/mods";
import { Trace } from "@/core/decorators";
import { UserScoreType } from "@domain/osu/Adapter.dto";

export class OsuScoreService extends AbstractService {
    @Trace()
    public async score(id: string | number, provider: AdapterProvider = AdapterProvider.Bancho): Promise<Score> {
        return this.adapter[provider].score({
            id: String(id),
        });
    }

    @Trace()
    public async replay(
        id: string | number,
        mode?: GameMode,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Uint8Array> {
        return this.adapter[provider].replay({
            id: String(id),
            mode,
        });
    }

    @Trace()
    public async best(
        id: number,
        mode: GameMode,
        limit: number,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<Score>> {
        return this.adapter[provider].best({
            id,
            mode,
            limit,
        });
    }

    @Trace()
    public async pinned(
        id: number,
        mode: GameMode,
        limit: number,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<Score>> {
        return this.adapter[provider].pinned({
            id,
            mode,
            limit,
        });
    }

    @Trace()
    public async firsts(
        id: number,
        mode: GameMode,
        limit: number,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<Score>> {
        return this.adapter[provider].firsts({
            id,
            mode,
            limit,
        });
    }

    @Trace()
    public async recent(
        id: number,
        mode: GameMode,
        limit: number,
        includeFails = false,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<Score>> {
        return this.adapter[provider].recent({
            id,
            mode,
            limit,
            includeFails,
        });
    }

    @Trace()
    public async userBeatmapScores(
        id: number,
        mode: GameMode,
        beatmapID: number,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<Score>> {
        return this.adapter[provider].user_beatmap_scores({
            id,
            mode,
            beatmapID,
        });
    }

    @Trace()
    public async beatmapScores(
        beatmapID: number,
        mode: GameMode,
        mods?: ReadonlyArray<ParsedMod> | null,
        legacyOnly?: boolean | null,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<Score>> {
        return this.adapter[provider].beatmap_scores({
            beatmapID,
            mode,
            mods: mods ? [...mods] : undefined,
            legacyOnly: legacyOnly ?? false,
        });
    }

    public async byType(
        id: number,
        mode: GameMode,
        type: UserScoreType,
        limit: number,
        includeFails = false,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<Score>> {
        switch (type) {
            case "recent":
                return this.recent(id, mode, limit, includeFails, provider);
            case "pinned":
                return this.pinned(id, mode, limit, provider);
            case "firsts":
                return this.firsts(id, mode, limit, provider);
            case "best":
            default:
                return this.best(id, mode, limit, provider);
        }
    }
}
