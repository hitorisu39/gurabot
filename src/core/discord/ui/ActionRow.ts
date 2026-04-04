import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageActionRowComponentBuilder } from "discord.js";

export class ActionRow extends ActionRowBuilder<MessageActionRowComponentBuilder> {
    constructor() {
        super();
    }

    public addButton(
        label: string,
        customID: string,
        style: ButtonStyle = ButtonStyle.Primary,
        options?: { emoji?: string; disabled?: boolean },
    ): this {
        const button = new ButtonBuilder().setLabel(label).setCustomId(customID).setStyle(style);

        if (options?.emoji) button.setEmoji(options.emoji);
        if (options?.disabled) button.setDisabled(options.disabled);

        this.addComponents(button);
        return this;
    }

    public addLinkButton(label: string, url: string, options?: { emoji?: string; disabled?: boolean }): this {
        const button = new ButtonBuilder().setLabel(label).setURL(url).setStyle(ButtonStyle.Link);

        if (options?.emoji) button.setEmoji(options.emoji);
        if (options?.disabled) button.setDisabled(options.disabled);

        this.addComponents(button);
        return this;
    }

    public addEmojiButton(
        emoji: string,
        customID: string,
        style: ButtonStyle = ButtonStyle.Primary,
        options?: { disabled?: boolean },
    ): this {
        const button = new ButtonBuilder().setEmoji(emoji).setCustomId(customID).setStyle(style);
        if (options?.disabled) button.setDisabled(options.disabled);
        this.addComponents(button);
        return this;
    }

    public add(component: MessageActionRowComponentBuilder): this {
        this.addComponents(component);
        return this;
    }
}
