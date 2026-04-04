import { StringSelectMenuOptionBuilder } from "@discordjs/builders";
import { StringSelectMenuBuilder } from "discord.js";

export class SelectMenu extends StringSelectMenuBuilder {
    private currentValue?: string;

    constructor(customID: string) {
        super();
        this.setCustomId(customID);
    }

    public addChoice(label: string, value: string | number, description?: string, emoji?: string): this {
        const stringValue = value.toString();
        const option = new StringSelectMenuOptionBuilder()
            .setLabel(label)
            .setValue(stringValue)
            .setDefault(stringValue === this.currentValue);

        if (description) option.setDescription(description);
        if (emoji) option.setEmoji({ name: emoji });

        this.addOptions(option);
        return this;
    }

    public setCurrent(value: string | number): this {
        this.currentValue = value.toString();
        return this;
    }
}
