import { AbstractService } from "@/core/framework/AbstractService";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { InteractionResponse, Message } from "discord.js";
import { AbstractView } from "@/core/discord/views/AbstractView";

export abstract class AbstractViewService<TData, TOptions = unknown>
    extends AbstractService
    implements AbstractView<TData, TOptions>
{
    protected abstract readonly ttl: number;

    public abstract build(
        sessionID: string,
        data: TData,
        options?: TOptions,
    ): TMessagePayload | Promise<TMessagePayload>;

    public afterRespond(_data: TData, _message: Message | InteractionResponse | null): void | Promise<void> {
        return;
    }

    public getTtl(): number {
        return this.ttl;
    }
}
