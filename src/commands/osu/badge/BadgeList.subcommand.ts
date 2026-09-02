import { Category, Command, Subcommand } from "@/core/decorators";
import { ECommandCategory } from "@domain/core/Command";
import { AbstractBadgeListCommand } from "./AbstractBadgeListCommand";

@Subcommand({
    root: "badge",
    name: "list",
    description: "Shows badges held by an osu! player.",
})
export class BadgeListSubcommand extends AbstractBadgeListCommand {}

@Category(ECommandCategory.Osu)
@Command({
    name: "badgelist",
    description: "Shows badges held by an osu! player.",
    aliases: ["badges"],
    prefixOnly: true,
})
export class BadgeListCommand extends AbstractBadgeListCommand {}
