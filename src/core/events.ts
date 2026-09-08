import { AutocompleteContext } from "./discord/context/AutocompleteContext";
import { CommandContext } from "./discord/context/CommandContext";
import { ComponentContext } from "./discord/context/ComponentContext";
import { IDiscordResponseEvent } from "./discord/context/DiscordContext";

export interface ICoreEvents {
    app: {
        ready(): void;
    };
    discord: {
        command(ctx: CommandContext): void;
        component(ctx: ComponentContext): void;
        autocomplete(ctx: AutocompleteContext): void;
        response(event: IDiscordResponseEvent): void;
    };
}
