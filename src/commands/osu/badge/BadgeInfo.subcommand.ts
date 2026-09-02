import { Category, Command, Subcommand } from "@/core/decorators";
import { ECommandCategory } from "@domain/core/Command";
import { AbstractBadgeInfoCommand } from "./AbstractBadgeInfoCommand";

@Subcommand({
    root: "badge",
    name: "info",
    description: "Shows information about an osu! badge.",
})
export class BadgeInfoSubcommand extends AbstractBadgeInfoCommand {}

@Category(ECommandCategory.Osu)
@Command({
    name: "badgeinfo",
    description: "Shows information about an osu! badge.",
    aliases: ["badge"],
    prefixOnly: true,
})
export class BadgeInfoCommand extends AbstractBadgeInfoCommand {}
