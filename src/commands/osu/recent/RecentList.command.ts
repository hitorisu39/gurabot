import { GameMode } from "@generated/adapter/types";
import { Category, Command, Subcommand } from "@/core/decorators";
import { AbstractRecentListCommand } from "./AbstractRecentListCommand";
import { ECommandCategory } from "@domain/core/Command";

@Subcommand({
    root: "recent",
    name: "list",
    description: "Shows a list of recent plays of an osu! player.",
})
export class RecentListSubcommand extends AbstractRecentListCommand {
    protected forcedPassed = false;
}

@Subcommand({
    root: "recent",
    name: "passlist",
    description: "Shows a list of recent passed plays of an osu! player.",
})
export class RecentPassListSubcommand extends AbstractRecentListCommand {
    protected forcedPassed = true;
}

@Command({
    name: "recentlist",
    description: "Shows a list of recent plays of an osu! player.",
    prefixOnly: true,
    aliases: ["rl"],
})
export class RecentListCommand extends AbstractRecentListCommand {
    protected forcedPassed = false;
}

@Command({
    name: "recentpasslist",
    description: "Shows a list of recent passed plays of an osu! player.",
    prefixOnly: true,
    aliases: ["rpl", "rlp"],
})
export class RecentPassListCommand extends AbstractRecentListCommand {
    protected forcedPassed = true;
}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikorecentlist",
    description: "Shows a list of recent taiko plays of an osu! player.",
    prefixOnly: true,
    aliases: ["trl", "rtl", "recenttaikolist"],
})
export class TaikoRecentListCommand extends AbstractRecentListCommand {
    protected forcedMode = GameMode.Taiko;
    protected forcedPassed = false;
}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikorecentpasslist",
    description: "Shows a list of recent passed taiko plays of an osu! player.",
    prefixOnly: true,
    aliases: ["rptl", "trpl", "trlp", "recentpasstaikolist"],
})
export class TaikoRecentPassListCommand extends AbstractRecentListCommand {
    protected forcedMode = GameMode.Taiko;
    protected forcedPassed = true;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchrecentlist",
    description: "Shows a list of recent catch plays of an osu! player.",
    prefixOnly: true,
    aliases: ["crl", "rcl", "recentcatchlist"],
})
export class CatchRecentListCommand extends AbstractRecentListCommand {
    protected forcedMode = GameMode.Catch;
    protected forcedPassed = false;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchrecentpasslist",
    description: "Shows a list of recent passed catch plays of an osu! player.",
    prefixOnly: true,
    aliases: ["rpcl", "crpl", "recentpasscatchlist"],
})
export class CatchRecentPassListCommand extends AbstractRecentListCommand {
    protected forcedMode = GameMode.Catch;
    protected forcedPassed = true;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniarecentlist",
    description: "Shows a list of recent mania plays of an osu! player.",
    prefixOnly: true,
    aliases: ["mrl", "rml", "recentmanialist"],
})
export class ManiaRecentListCommand extends AbstractRecentListCommand {
    protected forcedMode = GameMode.Mania;
    protected forcedPassed = false;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniarecentpasslist",
    description: "Shows a list of recent passed mania plays of an osu! player.",
    prefixOnly: true,
    aliases: ["rpml", "mrpl", "recentpassmanialist"],
})
export class ManiaRecentPassListCommand extends AbstractRecentListCommand {
    protected forcedMode = GameMode.Mania;
    protected forcedPassed = true;
}
