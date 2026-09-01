import { AbstractService } from "@/core/framework/AbstractService";
import { AdapterProvider, MatchEvents, RealtimeRoomEvents } from "@generated/adapter/types";
import { Trace } from "@/core/decorators";
import type { IMultiplayerEventsOptions } from "@domain/osu/Adapter.dto";

export class OsuMultiplayerService extends AbstractService {
    @Trace()
    public async match(
        id: number,
        options?: IMultiplayerEventsOptions,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<MatchEvents> {
        return this.adapter[provider].match({
            id,
            limit: options?.limit,
            before: options?.before,
            after: options?.after,
        });
    }

    @Trace()
    public async roomEvents(
        id: number,
        options?: IMultiplayerEventsOptions,
        provider: AdapterProvider = AdapterProvider.Bancho,
    ): Promise<RealtimeRoomEvents> {
        return this.adapter[provider].room_events({
            id,
            limit: options?.limit,
            before: options?.before,
            after: options?.after,
        });
    }
}
