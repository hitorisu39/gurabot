import { Category, Command, Subcommand } from "@/core/decorators";
import { ECommandCategory } from "@domain/core/Command";
import { AbstractMedalMissingCommand } from "./AbstractMedalMissingCommand";

@Subcommand({
    root: "medal",
    name: "missing",
    description: "Shows an osu! player's missing medals.",
})
export class MedalMissingSubcommand extends AbstractMedalMissingCommand {}

@Category(ECommandCategory.Osu)
@Command({
    name: "medalmissing",
    description: "Shows an osu! player's missing medals.",
    aliases: ["mm"],
    prefixOnly: true,
})
export class MedalMissingCommand extends AbstractMedalMissingCommand {}
