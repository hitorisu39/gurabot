import { AbstractService } from "@/core/framework/AbstractService";
import {
    AdapterProvider,
    Beatmap,
    BeatmapPlaycount,
    BeatmapSearchResult,
    Beatmapset,
    GameMode,
    RankingStatistics,
    RankingType,
    Score,
} from "@generated/adapter/types";
import { Import, Trace } from "@/core/decorators";
import { CalculatorService } from "./calculator/Calculator.service";
import { PopulatedUser } from "@domain/osu/Profile.dto";
import { plainToInstance } from "class-transformer";
import { PopulatedScore, ScoreWithMaps, ScoreWithPlacement } from "@domain/osu/Score.dto";
import { ProviderMeta } from "@generated/adapter";
import { ScorePlacementEvaluator } from "@domain/osu/utils/ScorePlacementEvaluator";
import { BeatmapUtils } from "@domain/osu/utils/BeatmapUtils";
import { ParsedMod } from "@generated/adapter/mods";
import { scoreBestQueryLimit } from "@domain/osu/configs/Score.config";
import { OsuUserService } from "./OsuUser.service";
import { OsuScoreService } from "./OsuScore.service";
import { OsuBeatmapService } from "./OsuBeatmap.service";
import { IBeatmapsetSearchInput, UserScoreType } from "@domain/osu/Adapter.dto";
import { OsuReplayService } from "./OsuReplay.service";

interface IUserWithScoresInput {
    nameOrID: string | number;
    mode: GameMode;
    type: UserScoreType;
    limit: number;
    includeFails?: boolean;
    provider?: AdapterProvider;
}

interface IPopulateScorePlacementsInput<T extends Score> {
    scores: Array<T>;
    userID: number;
    mode: GameMode;
    beatmap: Beatmap;
    provider?: AdapterProvider;
    personalScores?: Array<Score> | Promise<Array<Score>>;
    globalScores?: Array<Score> | Promise<Array<Score>>;
}

interface IUserBeatmapScoreContext {
    scores: Array<Score>;
    personalScores: Array<Score>;
    globalScores: Array<Score>;
}

export class OsuService extends AbstractService {
    @Import() declare private readonly calculatorService: CalculatorService;
    @Import() declare private readonly userService: OsuUserService;
    @Import() declare private readonly scoreService: OsuScoreService;
    @Import() declare private readonly beatmapService: OsuBeatmapService;
    @Import() declare private readonly replayService: OsuReplayService;

    //#region API

    public async user(
        nameOrID: string | number,
        mode: GameMode,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<PopulatedUser> {
        return this.userService.user(nameOrID, mode, provider);
    }

    public async score(id: string | number, provider: AdapterProvider = AdapterProvider.Bancho): Promise<Score> {
        return this.scoreService.score(id, provider);
    }

    public async replay(id: string | number, provider: AdapterProvider = AdapterProvider.Bancho): Promise<Uint8Array> {
        return this.replayService.replay(id, provider);
    }

    public async best(
        id: number,
        mode: GameMode,
        limit: number,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<Score>> {
        return this.scoreService.best(id, mode, limit, provider);
    }

    public async pinned(
        id: number,
        mode: GameMode,
        limit: number,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<Score>> {
        return this.scoreService.pinned(id, mode, limit, provider);
    }

    public async firsts(
        id: number,
        mode: GameMode,
        limit: number,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<Score>> {
        return this.scoreService.firsts(id, mode, limit, provider);
    }

    public async recent(
        id: number,
        mode: GameMode,
        limit: number,
        includeFails: boolean = false,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<Score>> {
        return this.scoreService.recent(id, mode, limit, includeFails, provider);
    }

    public async beatmap(
        id: number,
        provider: AdapterProvider = AdapterProvider.Bancho,
        bypassCache: boolean = false,
    ): Promise<Beatmap | null> {
        return this.beatmapService.beatmap(id, provider, bypassCache);
    }

    public async beatmaps(
        ids: Array<number>,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<Beatmap>> {
        return this.beatmapService.beatmaps(ids, provider);
    }

    public async beatmapset(
        id: number,
        provider: AdapterProvider = AdapterProvider.Bancho,
        bypassCache: boolean = false,
    ): Promise<Beatmapset | null> {
        return this.beatmapService.beatmapset(id, provider, bypassCache);
    }

    public async search(
        input: IBeatmapsetSearchInput = {},
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<BeatmapSearchResult> {
        return this.beatmapService.search(input, provider);
    }

    public async mostPlayed(
        id: number,
        options?: {
            limit?: number;
            offset?: number;
        },
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<BeatmapPlaycount>> {
        return this.beatmapService.mostPlayed(id, options, provider);
    }

    public async userBeatmapScores(
        id: number,
        mode: GameMode,
        beatmapID: number,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<Score>> {
        return this.scoreService.userBeatmapScores(id, mode, beatmapID, provider);
    }

    public async beatmapScores(
        beatmapID: number,
        mode: GameMode,
        mods?: ReadonlyArray<ParsedMod> | null,
        legacyOnly?: boolean | null,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<Score>> {
        return this.scoreService.beatmapScores(beatmapID, mode, mods, legacyOnly, provider);
    }

    public async resolveCachedID(nameOrID: string | number, provider: AdapterProvider): Promise<number | null> {
        return this.userService.resolveCachedID(nameOrID, provider);
    }

    @Trace()
    public async userWithScores(data: IUserWithScoresInput): Promise<{
        user: PopulatedUser;
        scores: Array<Score>;
    }> {
        const provider = data.provider ?? AdapterProvider.Bancho;
        const isCacheable = ProviderMeta[provider].cache;

        const { nameOrID, mode, type, limit, includeFails } = data;

        if (typeof nameOrID === "number") {
            const [user, scores] = await Promise.all([
                this.userService.user(nameOrID, mode, provider),
                this.scoreService.byType(nameOrID, mode, type, limit, includeFails, provider),
            ]);

            return {
                user,
                scores,
            };
        }

        const username = nameOrID.toLowerCase();
        let cachedID: number | null = null;

        if (isCacheable) {
            cachedID = await this.userService.resolveCachedID(username, provider);
        }

        if (cachedID) {
            const [user, initialScores] = await Promise.all([
                this.userService.user(username, mode, provider),
                this.scoreService.byType(cachedID, mode, type, limit, includeFails, provider).catch(() => null),
            ]);

            if (user.id !== cachedID || !initialScores) {
                this.logger.warn(
                    `Namechange detected or cache stale for ${username} (${provider}). Re-fetching scores...`,
                );

                const correctedScores = await this.scoreService.byType(
                    user.id,
                    mode,
                    type,
                    limit,
                    includeFails,
                    provider,
                );

                return {
                    user,
                    scores: correctedScores,
                };
            }

            return {
                user,
                scores: initialScores,
            };
        }

        const user = await this.userService.user(username, mode, provider);
        const scores = await this.scoreService.byType(user.id, mode, type, limit, includeFails, provider);

        return {
            user,
            scores,
        };
    }

    @Trace()
    public async rankings(
        mode: GameMode,
        type: RankingType,
        options?: {
            country?: string;
            filter?: string;
            variant?: string;
            page?: number;
        },
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<RankingStatistics>> {
        return this.adapter[provider].rankings({
            mode,
            type,
            country: options?.country,
            filter: options?.filter,
            variant: options?.variant,
            page: options?.page,
        });
    }

    @Trace()
    public async userBeatmapScoreContext(
        id: number,
        mode: GameMode,
        beatmap: Beatmap,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<IUserBeatmapScoreContext> {
        const beatmapScoresPromise = this.scoreService.userBeatmapScores(id, mode, beatmap.id, provider);
        const personalScoresPromise = this.scoreService.best(id, mode, scoreBestQueryLimit, provider);
        const globalScoresPromise = BeatmapUtils.hasLeaderboard(beatmap)
            ? this.scoreService.beatmapScores(beatmap.id, mode, null, null, provider)
            : Promise.resolve<Array<Score>>([]);

        const [scores, personalScores, globalScores] = await Promise.all([
            beatmapScoresPromise,
            personalScoresPromise,
            globalScoresPromise,
        ]);

        return {
            scores,
            personalScores,
            globalScores,
        };
    }

    @Trace()
    public async userWithBeatmapScoreContext(
        nameOrID: string | number,
        mode: GameMode,
        beatmap: Beatmap,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<{
        user: PopulatedUser;
        context: IUserBeatmapScoreContext;
    }> {
        if (typeof nameOrID === "number") {
            const [user, context] = await Promise.all([
                this.userService.user(nameOrID, mode, provider),
                this.userBeatmapScoreContext(nameOrID, mode, beatmap, provider),
            ]);

            return {
                user,
                context,
            };
        }

        const username = nameOrID.toLowerCase();

        const cachedID = ProviderMeta[provider].cache
            ? await this.userService.resolveCachedID(username, provider)
            : null;

        if (cachedID) {
            const [user, initialContext] = await Promise.all([
                this.userService.user(username, mode, provider),
                this.userBeatmapScoreContext(cachedID, mode, beatmap, provider).catch(() => null),
            ]);

            if (user.id !== cachedID || !initialContext) {
                this.logger.warn(
                    `Namechange detected or cache stale for ${username} (${provider}). Re-fetching beatmap score context...`,
                );

                const context = await this.userBeatmapScoreContext(user.id, mode, beatmap, provider);

                return {
                    user,
                    context,
                };
            }

            return {
                user,
                context: initialContext,
            };
        }

        const user = await this.userService.user(username, mode, provider);
        const context = await this.userBeatmapScoreContext(user.id, mode, beatmap, provider);

        return {
            user,
            context,
        };
    }

    @Trace()
    public async populateMaps(
        scores: Array<Score>,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<ScoreWithMaps>> {
        const mapIDs = [...new Set(scores.map((score) => score.beatmapID))];
        const fetchedMaps = mapIDs.length > 0 ? await this.beatmapService.beatmaps(mapIDs, provider) : [];
        const mapDict = new Map(fetchedMaps.map((map) => [map.id, map]));
        const populated: Array<ScoreWithMaps> = [];

        for (const score of scores) {
            const fetched = mapDict.get(score.beatmapID);

            if (fetched?.beatmapset) {
                populated.push({
                    ...score,
                    beatmap: fetched,
                    beatmapset: fetched.beatmapset,
                });
            }
        }

        return plainToInstance(ScoreWithMaps, populated);
    }

    @Trace()
    public async populateCalculations<M extends GameMode>(
        scores: Array<ScoreWithMaps>,
        mode: M,
        includeFC: boolean = false,
    ): Promise<Array<PopulatedScore<M>>> {
        return this.calculatorService.scores(scores, mode, includeFC);
    }

    @Trace()
    public async populateAll<M extends GameMode>(
        scores: Array<Score>,
        mode: M,
        includeFC: boolean = true,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<Array<PopulatedScore<M>>> {
        const withMaps = await this.populateMaps(scores, provider);

        return this.populateCalculations(withMaps, mode, includeFC);
    }

    @Trace()
    public async populateScorePlacements<T extends Score>(
        data: IPopulateScorePlacementsInput<T>,
    ): Promise<Array<T & ScoreWithPlacement>> {
        if (!data.scores.length) {
            return [];
        }

        const provider = data.provider ?? AdapterProvider.Bancho;

        const personalScoresPromise =
            data.personalScores !== undefined
                ? Promise.resolve(data.personalScores)
                : this.scoreService.best(data.userID, data.mode, 100, provider);

        const globalScoresPromise =
            data.globalScores !== undefined
                ? Promise.resolve(data.globalScores)
                : BeatmapUtils.hasLeaderboard(data.beatmap)
                  ? this.scoreService.beatmapScores(data.beatmap.id, data.mode, null, null, provider)
                  : Promise.resolve<Array<Score>>([]);

        const [personalScores, globalScores] = await Promise.all([personalScoresPromise, globalScoresPromise]);

        return new ScorePlacementEvaluator(data.beatmap, personalScores, globalScores).evaluate(data.scores);
    }

    //#endregion
}
