import { EApplicationError, Exception } from "@domain/core/Exception";
import { Trace } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { HttpClient } from "@/http";
import { AmeobeaPeakDto } from "@domain/ameobea/Ameobea.dto";
import { AdapterProvider, GameMode } from "@generated/adapter/types";
import { plainToInstance } from "class-transformer";

export class AmeobeaService extends AbstractService {
    declare private http: HttpClient;

    private readonly name = "Ameobea";
    private readonly base = "https://osutrack-api.ameo.dev";
    private readonly timeout = 1000;

    public init(): void {
        this.http = new HttpClient(this.logger, { name: this.name, baseURL: this.base });
    }

    @Trace()
    public async peak(userID: number, mode: GameMode, provider: AdapterProvider): Promise<AmeobeaPeakDto> {
        if (provider !== AdapterProvider.Bancho) throw new Exception(EApplicationError.INTERNAL_ERROR);

        const data = await this.http.get<Array<AmeobeaPeakDto>>("/peak", {
            params: {
                user: userID,
                mode: this.gamemode(mode),
            },
            timeout: this.timeout,
        });

        if (!data || !data.length)
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} returned no data`);

        return plainToInstance(AmeobeaPeakDto, data[0]);
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
