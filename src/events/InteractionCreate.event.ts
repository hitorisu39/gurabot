import { AbstractDiscordEvent } from "@/core/discord/AbstractDiscordEvent";
import { AutocompleteContext } from "@/core/discord/context/AutocompleteContext";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { SlashContext } from "@/core/discord/context/SlashContext";
import { Interaction, CacheType } from "discord.js";

export class InteractionCreateEvent extends AbstractDiscordEvent<"interactionCreate"> {
    public readonly event = "interactionCreate";

    public async execute(interaction: Interaction<CacheType>): Promise<void> {
        if (interaction.isAutocomplete()) {
            const ctx = new AutocompleteContext(interaction);
            return this.dispatcher.dispatch("discord", "autocomplete", ctx);
        }

        if (interaction.isChatInputCommand()) {
            const ctx = new SlashContext(interaction);
            return this.dispatcher.dispatch("discord", "command", ctx);
        }

        if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
            const ctx = new ComponentContext(interaction);
            return this.dispatcher.dispatch("discord", "component", ctx);
        }
    }
}
