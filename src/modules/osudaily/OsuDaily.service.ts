import { Trace } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { HttpClient } from "@/http";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { AdapterProvider, GameMode } from "@generated/adapter/types";

type TOsuDailyLookupType = "pp" | "rank";

export class OsuDailyService extends AbstractService {
    declare private http: HttpClient;

    private readonly name = "osu!daily";
    private readonly base = "https://osudaily.net";
    private readonly timeout = 2000;

    public init(): void {
        this.http = new HttpClient(this.logger, {
            name: this.name,
            baseURL: this.base,
        });
    }

    @Trace()
    public async rankByPP(pp: number, mode: GameMode, provider: AdapterProvider): Promise<number> {
        const rank = await this.lookup("pp", pp, mode, provider);
        return rank;
    }

    @Trace()
    public async ppByRank(rank: number, mode: GameMode, provider: AdapterProvider): Promise<number> {
        const pp = await this.lookup("rank", rank, mode, provider);
        return pp;
    }

    private async lookup(
        type: TOsuDailyLookupType,
        value: number,
        mode: GameMode,
        provider: AdapterProvider,
    ): Promise<number> {
        if (provider !== AdapterProvider.Bancho) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} only supports Bancho`);
        }

        const data = await this.http.get<number>("/data/getPPRank.php", {
            params: {
                t: type,
                v: type === "rank" ? Math.round(value) : value,
                m: this.gamemode(mode),
            },
            timeout: this.timeout,
        });

        return data;
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
