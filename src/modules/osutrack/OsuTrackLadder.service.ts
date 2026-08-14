import { AbstractService } from "@/core/framework/AbstractService";
import { Trace } from "@/core/decorators";
import { HttpClient } from "@/http";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { TOsuTrackLadderPoint, OsuTrackLadderSimulationConfigDto } from "@domain/osutrack/OsuTrack.dto";
import { AdapterProvider, GameMode } from "@generated/adapter/types";
import { plainToInstance } from "class-transformer";

export class OsuTrackLadderService extends AbstractService {
    declare private http: HttpClient;

    private readonly name = "osu!track ladder";
    private readonly base = "https://osu-api-bridge.ameo.dev";

    private readonly timeout = 20_000;

    /**
     * 6 hours cache
     */
    private readonly simulationConfigCacheTtl = 6 * 60 * 60;
    private readonly pendingSimulationConfigRequests = new Map<number, Promise<OsuTrackLadderSimulationConfigDto>>();

    public init(): void {
        this.http = new HttpClient(this.logger, {
            name: this.name,
            baseURL: this.base,
        });
    }

    @Trace()
    public async simulationConfig(
        mode: GameMode,
        provider: AdapterProvider,
    ): Promise<OsuTrackLadderSimulationConfigDto> {
        this.validateProvider(provider);

        const modeID = this.gamemode(mode);
        const cacheID = String(modeID);
        const cached = await this.cache.get("osutrack_ladder_simulation_config", cacheID);

        if (cached) {
            const config = this.normalizeConfig(plainToInstance(OsuTrackLadderSimulationConfigDto, cached));
            if (this.isValidConfig(config)) {
                return config;
            }
        }

        const pending = this.pendingSimulationConfigRequests.get(modeID);

        if (pending) {
            return await pending;
        }

        const request = this.fetchSimulationConfig(modeID, cacheID);
        this.pendingSimulationConfigRequests.set(modeID, request);

        try {
            return await request;
        } finally {
            this.pendingSimulationConfigRequests.delete(modeID);
        }
    }

    private async fetchSimulationConfig(modeID: number, cacheID: string): Promise<OsuTrackLadderSimulationConfigDto> {
        const data = await this.http.get<OsuTrackLadderSimulationConfigDto>("/analysis/simulation-config", {
            params: {
                mode: modeID,
            },
            timeout: this.timeout,
        });

        const config = this.normalizeConfig(plainToInstance(OsuTrackLadderSimulationConfigDto, data));

        if (!this.isValidConfig(config)) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                `${this.name} returned an invalid simulation config.`,
            );
        }

        await this.cache.set("osutrack_ladder_simulation_config", config, this.simulationConfigCacheTtl, cacheID);
        return config;
    }

    private normalizeConfig(config: OsuTrackLadderSimulationConfigDto): OsuTrackLadderSimulationConfigDto {
        const normalized = new OsuTrackLadderSimulationConfigDto();

        normalized.rankToDecay = this.normalizePoints(config.rankToDecay);
        normalized.rankToDensity = this.normalizePoints(config.rankToDensity);
        normalized.rankToPp = this.normalizePoints(config.rankToPp);

        return normalized;
    }

    private normalizePoints(raw: ReadonlyArray<TOsuTrackLadderPoint> | undefined): Array<TOsuTrackLadderPoint> {
        if (!Array.isArray(raw)) {
            return [];
        }

        const byRank = new Map<number, TOsuTrackLadderPoint>();

        for (const entry of raw) {
            if (!Array.isArray(entry) || entry.length < 2) {
                continue;
            }

            const rank = Number(entry[0]);
            const value = Number(entry[1]);

            if (!Number.isInteger(rank) || rank < 1 || !Number.isFinite(value) || value < 0) {
                continue;
            }

            byRank.set(rank, [rank, value]);
        }

        return Array.from(byRank.values()).sort((a, b) => a[0] - b[0]);
    }

    private isValidConfig(config: OsuTrackLadderSimulationConfigDto): boolean {
        return config.rankToDecay.length >= 2 && config.rankToDensity.length >= 2 && config.rankToPp.length >= 2;
    }

    private validateProvider(provider: AdapterProvider): void {
        if (provider !== AdapterProvider.Bancho) {
            throw new Exception(EApplicationError.NOT_FOUND, "osu!track graphs are only available for Bancho users.");
        }
    }

    private gamemode(mode: GameMode): number {
        switch (mode) {
            case GameMode.Standard:
                return 0;
            case GameMode.Taiko:
                return 1;
            case GameMode.Catch:
                return 2;
            case GameMode.Mania:
                return 3;
        }
    }
}
