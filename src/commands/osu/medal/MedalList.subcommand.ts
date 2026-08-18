import { Category, Command, Subcommand } from "@/core/decorators";
import { AbstractMedalListCommand } from "./AbstractMedalListCommand";
import { ECommandCategory } from "@domain/core/Command";

@Subcommand({
    root: "medal",
    name: "list",
    description: "Shows an osu! player's achieved medals.",
})
export class MedalListSubcommand extends AbstractMedalListCommand {}

@Category(ECommandCategory.Osu)
@Command({
    name: "medallist",
    description: "Shows an osu! player's achieved medals.",
    aliases: ["ml"],
    prefixOnly: true,
})
export class MedalListCommand extends AbstractMedalListCommand {}
