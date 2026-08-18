import { Category, Command, Subcommand } from "@/core/decorators";
import { ECommandCategory } from "@domain/core/Command";
import { AbstractMedalRecentCommand } from "./AbstractMedalRecentCommand";

@Subcommand({
    root: "medal",
    name: "recent",
    description: "Shows recently achieved medals of an osu! player.",
})
export class MedalRecentSubcommand extends AbstractMedalRecentCommand {}

@Category(ECommandCategory.Osu)
@Command({
    name: "medalrecent",
    description: "Shows recently achieved medals of an osu! player.",
    aliases: ["mr"],
    prefixOnly: true,
})
export class MedalRecentCommand extends AbstractMedalRecentCommand {}
