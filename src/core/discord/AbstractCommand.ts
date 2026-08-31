import { AbstractInteraction } from "./AbstractInteraction";
import { AutocompleteContext } from "./context/AutocompleteContext";
import { CommandContext } from "./context/CommandContext";

export abstract class AbstractCommand extends AbstractInteraction {
    /**
     * Method responsible for executing command logic.
     *
     * @param ctx Command context
     */
    public abstract execute(ctx: CommandContext): Promise<void> | void;

    /**
     * Method responsible for handling autocomplete logic.
     *
     * @param ctx Autocomplete context
     */
    public async autocomplete?(ctx: AutocompleteContext): Promise<void>;

    /**
     * Provides variables for template strings in the command's @Help decorator.
     * Can be overridden by subclasses to inject dynamic context.
     */
    public getHelpContext(): Record<string, string> {
        return {};
    }
}
