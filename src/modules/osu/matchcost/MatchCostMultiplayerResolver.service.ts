import { Import } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { OsuService } from "@/modules/osu/Osu.service";
import { EMatchCostTargetType, EMatchCostTeam } from "@domain/osu/enums/MatchCost.enum";
import {
    MatchCostGameDto,
    MatchCostMatchDto,
    MatchCostScoreDto,
    MatchCostTargetDto,
    MatchCostUserDto,
} from "@domain/osu/MatchCost.dto";
import { wait } from "@domain/utils/utils";
import {
    AdapterProvider,
    MatchEvent,
    MatchEvents,
    MatchGame,
    RealtimeRoomEventType,
    RealtimeRoomEvents,
    RealtimeRoomPlaylistItem,
} from "@generated/adapter/types";
import { plainToInstance } from "class-transformer";

export class MatchCostMultiplayerResolverService extends AbstractService {
    @Import() declare private readonly osuService: OsuService;

    /**
     * How many events we want to receive *per page*.
     */
    private readonly eventPageSize = 100;

    /**
     * How many pages of events we want to receive.
     * E.g. 100 events with 5 pages means we'll fetch 500 events.
     */
    private readonly maxEventPages = 5;

    /**
     * For how long we want to cache an ongoing match.
     */
    private readonly activeCacheTtl = 20;

    /**
     * For how long we watch to cache an ended match.
     */
    private readonly endedCacheTtl = 5 * 60;

    private readonly cacheLockTtl = 15000;
    private readonly cacheWaitAttempts = 12;
    private readonly cacheWaitInterval = 250;

    public async resolve(target: MatchCostTargetDto): Promise<MatchCostMatchDto> {
        const cacheID = this.cacheID(target);

        const cached = await this.cache.getInstance("osu_matchcost", MatchCostMatchDto, cacheID);
        if (cached) {
            return cached;
        }

        const lockKey = `lock:osu_matchcost:${cacheID}`;
        const lock = await this.cache.acquireLock(lockKey, this.cacheLockTtl);

        if (!lock) {
            const populated = await this.waitForCache(cacheID);
            if (populated) {
                return populated;
            }

            return this.resolveAndCache(target, cacheID);
        }

        try {
            /**
             * Another request may have populated the cache between our initial
             * miss and acquiring the distributed lock, so check once more.
             */
            const cachedAfterLock = await this.cache.getInstance("osu_matchcost", MatchCostMatchDto, cacheID);
            if (cachedAfterLock) {
                return cachedAfterLock;
            }

            return await this.resolveAndCache(target, cacheID);
        } finally {
            await this.cache.releaseLock(lockKey, lock);
        }
    }

    private async resolveAndCache(target: MatchCostTargetDto, cacheID: string): Promise<MatchCostMatchDto> {
        let match: MatchCostMatchDto;

        switch (target.type) {
            case EMatchCostTargetType.Match:
                match = await this.resolveMatch(target.id);
                break;
            case EMatchCostTargetType.Room:
                match = await this.resolveRoom(target.id);
                break;
        }

        const ttl = match.ended ? this.endedCacheTtl : this.activeCacheTtl;
        await this.cache.set("osu_matchcost", match, ttl, cacheID);

        return match;
    }

    private async resolveMatch(id: number): Promise<MatchCostMatchDto> {
        const response = await this.fetchAllMatchEvents(id);

        const games = response.events
            .filter((event): event is MatchEvent & { game: NonNullable<MatchGame> } => !!event.game?.endTime)
            .map((event) => {
                const game = event.game;
                return {
                    id: game.id,
                    beatmapID: game.beatmapID,
                    startedAt: game.startTime,
                    scores: game.scores.map(
                        (score): MatchCostScoreDto => ({
                            userID: score.userID,
                            score: score.totalScore,
                            easy: score.mods.some((mod) => mod.acronym === "EZ"),
                            team: this.parseTeam(score.match?.team),
                        }),
                    ),
                };
            });

        const teamVs = response.events.some((event) => event.game?.teamType === "team-vs");

        return plainToInstance(MatchCostMatchDto, {
            id,
            type: EMatchCostTargetType.Match,
            name: response.match.name,
            ended: !!response.match.endTime,
            teamVs,
            users: response.users.map(
                (user): MatchCostUserDto => ({
                    id: user.id,
                    username: user.username,
                    countryCode: user.countryCode,
                }),
            ),
            games,
        });
    }

    private async resolveRoom(id: number): Promise<MatchCostMatchDto> {
        const response = await this.fetchAllRoomEvents(id);

        const completedPlaylistIDs = new Set(
            response.events
                .filter((event) => event.eventType === RealtimeRoomEventType.GameCompleted)
                .map((event) => event.playlistItemID)
                .filter((value): value is number => value !== undefined),
        );

        const items = response.playlistItems
            .filter((item) => completedPlaylistIDs.has(item.id))
            .filter((item) => !!item.playedAt)
            .sort((a, b) => (a.playedAt?.getTime() ?? 0) - (b.playedAt?.getTime() ?? 0));

        const games = items.map((item) => this.normalizeRoomGame(item));
        const teamVs = items.some((item) => this.roomType(item) === "team_versus");

        return plainToInstance(MatchCostMatchDto, {
            id,
            type: EMatchCostTargetType.Room,
            name: response.room.name,
            ended: !response.room.active,
            teamVs,
            users: response.users.map(
                (user): MatchCostUserDto => ({
                    id: user.id,
                    username: user.username,
                    countryCode: user.countryCode,
                }),
            ),
            games,
        });
    }

    private normalizeRoomGame(item: RealtimeRoomPlaylistItem): MatchCostGameDto {
        const teams = this.roomTeams(item);

        return {
            id: item.id,
            beatmapID: item.beatmapID,
            startedAt: this.roomStartedAt(item),
            scores: item.scores.map(
                (score): MatchCostScoreDto => ({
                    userID: score.userID,
                    score: score.totalScore,
                    easy: score.mods.some((mod) => mod.acronym === "EZ"),
                    team: this.parseTeam(teams?.[score.userID.toString()]),
                }),
            ),
        };
    }

    private async fetchAllMatchEvents(id: number): Promise<MatchEvents> {
        let page = await this.osuService.match(id, { limit: this.eventPageSize }, AdapterProvider.Bancho);

        const initial = page;
        const events = new Map(page.events.map((event) => [event.id, event]));
        const users = new Map(page.users.map((user) => [user.id, user]));

        for (let index = 1; index < this.maxEventPages; index++) {
            const oldestEventID = page.events[0]?.id;
            if (!oldestEventID || oldestEventID <= initial.firstEventID) {
                break;
            }

            const next = await this.osuService.match(
                id,
                { limit: this.eventPageSize, before: oldestEventID },
                AdapterProvider.Bancho,
            );

            if (!next.events.length) {
                break;
            }

            for (const event of next.events) {
                events.set(event.id, event);
            }

            for (const user of next.users) {
                users.set(user.id, user);
            }

            const nextOldestEventID = next.events[0]?.id;
            if (!nextOldestEventID || nextOldestEventID >= oldestEventID) {
                break;
            }

            page = next;
        }

        initial.events = [...events.values()].sort((a, b) => a.id - b.id);
        initial.users = [...users.values()];

        return initial;
    }

    private async fetchAllRoomEvents(id: number): Promise<RealtimeRoomEvents> {
        let page = await this.osuService.roomEvents(id, { limit: this.eventPageSize }, AdapterProvider.Bancho);

        const initial = page;

        const events = new Map(page.events.map((event) => [event.id, event]));
        const playlistItems = new Map(page.playlistItems.map((item) => [item.id, item]));
        const users = new Map(page.users.map((user) => [user.id, user]));

        for (let index = 1; index < this.maxEventPages; index++) {
            const oldestEventID = page.events[0]?.id;
            if (!oldestEventID || oldestEventID <= initial.firstEventID) {
                break;
            }

            const next = await this.osuService.roomEvents(
                id,
                { limit: this.eventPageSize, before: oldestEventID },
                AdapterProvider.Bancho,
            );

            if (!next.events.length) {
                break;
            }

            for (const event of next.events) {
                events.set(event.id, event);
            }

            for (const item of next.playlistItems) {
                playlistItems.set(item.id, item);
            }

            for (const user of next.users) {
                users.set(user.id, user);
            }

            const nextOldestEventID = next.events[0]?.id;
            if (!nextOldestEventID || nextOldestEventID >= oldestEventID) {
                break;
            }

            page = next;
        }

        initial.events = [...events.values()].sort((a, b) => a.id - b.id);
        initial.playlistItems = [...playlistItems.values()];
        initial.users = [...users.values()];

        return initial;
    }

    private async waitForCache(cacheID: string): Promise<MatchCostMatchDto | null> {
        for (let attempt = 0; attempt < this.cacheWaitAttempts; attempt++) {
            await wait(this.cacheWaitInterval);

            const cached = await this.cache.getInstance("osu_matchcost", MatchCostMatchDto, cacheID);
            if (cached) {
                return cached;
            }
        }

        return null;
    }

    private cacheID(target: MatchCostTargetDto): string {
        return `${target.type}:${target.id}`;
    }

    private parseTeam(value?: string): EMatchCostTeam | undefined {
        switch (value?.toLowerCase()) {
            case "red":
                return EMatchCostTeam.Red;
            case "blue":
                return EMatchCostTeam.Blue;
            default:
                return undefined;
        }
    }

    private roomType(item: RealtimeRoomPlaylistItem): string | undefined {
        const details = item.details as { room_type?: string };
        return details.room_type;
    }

    private roomTeams(item: RealtimeRoomPlaylistItem): Record<string, string> | null | undefined {
        const details = item.details as { teams?: Record<string, string> | null };
        return details.teams;
    }

    private roomStartedAt(item: RealtimeRoomPlaylistItem): Date {
        const details = item.details as { started_at?: string };
        if (details.started_at) {
            return new Date(details.started_at);
        }

        return item.playedAt ?? item.createdAt;
    }
}
