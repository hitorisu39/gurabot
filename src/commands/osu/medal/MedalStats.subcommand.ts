import { Category, Command, Subcommand } from "@/core/decorators";
import { ECommandCategory } from "@domain/core/Command";
import { AbstractMedalStatsCommand } from "./AbstractMedalStatsCommand";

@Subcommand({
    root: "medal",
    name: "stats",
    description: "Shows an osu! player's medal statistics.",
})
export class MedalStatsSubcommand extends AbstractMedalStatsCommand {}

@Category(ECommandCategory.Osu)
@Command({
    name: "medalstats",
    description: "Shows an osu! player's medal statistics.",
    aliases: ["ms"],
    prefixOnly: true,
})
export class MedalStatsCommand extends AbstractMedalStatsCommand {}
