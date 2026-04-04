import { AbstractDiscordEvent } from "@/core/discord/AbstractDiscordEvent";
import { ComponentContext } from "@/core/discord/context/ComponentContext";
import { SlashContext } from "@/core/discord/context/SlashContext";
import { Interaction, CacheType } from "discord.js";

export class InteractionCreateEvent extends AbstractDiscordEvent<"interactionCreate"> {
    public readonly event = "interactionCreate";

    public async execute(interaction: Interaction<CacheType>): Promise<void> {
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
