import { Trace } from "@/core/decorators";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { EOtrKeyType } from "@domain/otr/enums/Otr.enum";
import { OtrMatchDetailDto } from "@domain/otr/OtrMatch.dto";
import { otrKeyTypeValue } from "@domain/otr/configs/Otr.config";
import { plainToInstance } from "class-transformer";
import { AbstractOtrService } from "./AbstractOtrService";

export class OtrMatchService extends AbstractOtrService {
    private readonly matchCacheTtl = 5 * 60;
    private readonly pendingRequests = new Map<string, Promise<OtrMatchDetailDto>>();

    @Trace()
    public async get(id: number, keyType: EOtrKeyType = EOtrKeyType.Otr): Promise<OtrMatchDetailDto> {
        if (keyType === EOtrKeyType.Username) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, `${this.name} cannot resolve matches by username`);
        }

        const cacheKey = `${keyType}:${id}`;
        const cached = await this.cache.getInstance("otr_match", OtrMatchDetailDto, cacheKey);
        if (cached) return cached;

        const pending = this.pendingRequests.get(cacheKey);
        if (pending) return await pending;

        const request = this.fetch(id, keyType);
        this.pendingRequests.set(cacheKey, request);

        try {
            const result = await request;
            await this.cache.set("otr_match", result, this.matchCacheTtl, cacheKey);
            return result;
        } finally {
            this.pendingRequests.delete(cacheKey);
        }
    }

    private async fetch(id: number, keyType: EOtrKeyType): Promise<OtrMatchDetailDto> {
        const data = await this.http.get<OtrMatchDetailDto>(`/matches/${id}`, {
            params: {
                keyType: otrKeyTypeValue[keyType],
            },
            timeout: this.heavyTimeout,
        });

        if (!data) {
            throw new Exception(EApplicationError.NOT_FOUND, `${this.name} returned no match`);
        }

        return plainToInstance(OtrMatchDetailDto, data);
    }
}
