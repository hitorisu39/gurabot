import { Category, Command, Subcommand } from "@/core/decorators";
import { ECommandCategory } from "@domain/core/Command";
import { AbstractMedalInfoCommand } from "./AbstractMedalInfoCommand";

@Subcommand({
    root: "medal",
    name: "info",
    description: "Shows information about an osu! medal.",
})
export class MedalInfoSubcommand extends AbstractMedalInfoCommand {}

@Category(ECommandCategory.Osu)
@Command({
    name: "medalinfo",
    description: "Shows information about an osu! medal.",
    aliases: ["medal"],
    prefixOnly: true,
})
export class MedalInfoCommand extends AbstractMedalInfoCommand {}
