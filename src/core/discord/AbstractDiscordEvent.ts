import { ClientEvents } from "discord.js";
import { AbstractInteraction } from "./AbstractInteraction";

export abstract class AbstractDiscordEvent<K extends keyof ClientEvents> extends AbstractInteraction {
    public abstract readonly event: K;
    public readonly once: boolean = false;

    public abstract execute(...args: ClientEvents[K]): Promise<void> | void;
}
