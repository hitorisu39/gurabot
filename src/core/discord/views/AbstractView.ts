import { InteractionResponse, Message } from "discord.js";
import { TMessagePayload } from "../context/CommandContext";

export interface AbstractView<TData, TOptions = unknown> {
    build(sessionID: string, data: TData, options?: TOptions): TMessagePayload | Promise<TMessagePayload>;
    getTtl(): number;
    afterRespond(data: TData, message: Message | InteractionResponse | null): void | Promise<void>;
}
