import { ClientEvents } from "discord.js";
import { AbstractInteraction } from "./AbstractInteraction";
import { IDiscordContextEvents } from "./context/DiscordContext";

export abstract class AbstractDiscordEvent<K extends keyof ClientEvents> extends AbstractInteraction {
    public abstract readonly event: K;
    public readonly once: boolean = false;

    protected readonly contextEvents: IDiscordContextEvents = {
        response: (event) => {
            this.dispatcher.dispatch("discord", "response", event);
        },
    };

    public abstract execute(...args: ClientEvents[K]): Promise<void> | void;
}
