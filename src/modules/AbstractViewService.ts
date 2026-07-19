import { AbstractService } from "@/core/framework/AbstractService";
import { TMessagePayload } from "@/core/discord/context/CommandContext";

export abstract class AbstractViewService<TData, TOptions = unknown> extends AbstractService {
    protected abstract readonly ttl: number;

    public abstract build(
        sessionID: string,
        data: TData,
        options?: TOptions,
    ): TMessagePayload | Promise<TMessagePayload>;

    public getTtl(): number {
        return this.ttl;
    }
}
