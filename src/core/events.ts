import { AutocompleteContext } from "./discord/context/AutocompleteContext";
import { CommandContext } from "./discord/context/CommandContext";
import { ComponentContext } from "./discord/context/ComponentContext";

export interface ICoreEvents {
    app: {
        ready(): void;
    };
    discord: {
        command(ctx: CommandContext): void;
        component(ctx: ComponentContext): void;
        autocomplete(ctx: AutocompleteContext): void;
    };
}
