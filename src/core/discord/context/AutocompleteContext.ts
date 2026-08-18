import { ApplicationCommandOptionChoiceData, AutocompleteInteraction, CacheType } from "discord.js";

export class AutocompleteContext {
    public constructor(public readonly interaction: AutocompleteInteraction<CacheType>) {}

    public get commandName(): string {
        return this.interaction.commandName;
    }

    public getSubcommand(): string | null {
        return this.interaction.options.getSubcommand(false);
    }

    public getSubcommandGroup(): string | null {
        return this.interaction.options.getSubcommandGroup(false);
    }

    public getFocused() {
        return this.interaction.options.getFocused(true);
    }

    public async respond(choices: ReadonlyArray<ApplicationCommandOptionChoiceData>): Promise<void> {
        await this.interaction.respond(choices);
    }
}
