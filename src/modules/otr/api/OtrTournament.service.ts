import { Trace } from "@/core/decorators";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { OtrTournamentDetailDto } from "@domain/otr/OtrTournament.dto";
import { plainToInstance } from "class-transformer";
import { AbstractOtrService } from "./AbstractOtrService";

export class OtrTournamentService extends AbstractOtrService {
    private readonly tournamentCacheTtl = 5 * 60;
    private readonly pendingRequests = new Map<number, Promise<OtrTournamentDetailDto>>();

    @Trace()
    public async get(id: number): Promise<OtrTournamentDetailDto> {
        const cacheKey = String(id);
        const cached = await this.cache.getInstance("otr_tournament", OtrTournamentDetailDto, cacheKey);
        if (cached) return cached;

        const pending = this.pendingRequests.get(id);
        if (pending) return await pending;

        const request = this.fetch(id);
        this.pendingRequests.set(id, request);

        try {
            const result = await request;
            await this.cache.set("otr_tournament", result, this.tournamentCacheTtl, cacheKey);
            return result;
        } finally {
            this.pendingRequests.delete(id);
        }
    }

    private async fetch(id: number): Promise<OtrTournamentDetailDto> {
        const data = await this.http.get<OtrTournamentDetailDto>(`/tournaments/${id}`, {
            timeout: this.heavyTimeout,
        });

        if (!data) {
            throw new Exception(EApplicationError.NOT_FOUND, `${this.name} returned no tournament`);
        }

        return plainToInstance(OtrTournamentDetailDto, data);
    }
}
