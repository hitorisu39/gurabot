import {
    discordEmbedColorError,
    discordEmbedColorGeneral,
    discordEmbedColorSuccess,
    discordEmbedColorWarn,
} from "@domain/discord/configs/Embed.config";
import { EmbedBuilder } from "discord.js";

export class Embed extends EmbedBuilder {
    constructor() {
        super();
        this.setColor(discordEmbedColorGeneral);
    }

    public static general(message: string): Embed {
        return new Embed().setDescription(`${message}`);
    }

    public static error(message: string): Embed {
        return new Embed().setColor(discordEmbedColorError).setDescription(`${message}`);
    }

    public static warn(message: string): Embed {
        return new Embed().setColor(discordEmbedColorWarn).setDescription(`${message}`);
    }

    public static success(message: string): Embed {
        return new Embed().setColor(discordEmbedColorSuccess).setDescription(`${message}`);
    }
}
