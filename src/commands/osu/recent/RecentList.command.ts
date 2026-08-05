import { GameMode } from "@generated/adapter/types";
import { Command, Subcommand } from "@/core/decorators";
import { AbstractRecentListCommand } from "./AbstractRecentListCommand";

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
    aliases: ["rl"],
})
export class RecentListCommand extends AbstractRecentListCommand {
    protected forcedPassed = false;
}

@Command({
    name: "recentpasslist",
    description: "Shows a list of recent passed plays of an osu! player.",
    aliases: ["rpl", "rlp"],
})
export class RecentPassListCommand extends AbstractRecentListCommand {
    protected forcedPassed = true;
}

// Taiko

@Command({
    name: "recenttaikolist",
    description: "Shows a list of recent taiko plays of an osu! player.",
    prefixOnly: true,
    aliases: ["trl", "rtl"],
})
export class RecentTaikoListCommand extends AbstractRecentListCommand {
    protected forcedMode = GameMode.Taiko;
    protected forcedPassed = false;
}

@Command({
    name: "recentpasstaikolist",
    description: "Shows a list of recent passed taiko plays of an osu! player.",
    prefixOnly: true,
    aliases: ["rptl", "trpl", "trlp"],
})
export class RecentPassTaikoListCommand extends AbstractRecentListCommand {
    protected forcedMode = GameMode.Taiko;
    protected forcedPassed = true;
}

// Catch

@Command({
    name: "recentcatchlist",
    description: "Shows a list of recent catch plays of an osu! player.",
    prefixOnly: true,
    aliases: ["crl", "rcl"],
})
export class RecentCatchListCommand extends AbstractRecentListCommand {
    protected forcedMode = GameMode.Catch;
    protected forcedPassed = false;
}

@Command({
    name: "recentpasscatchlist",
    description: "Shows a list of recent passed catch plays of an osu! player.",
    prefixOnly: true,
    aliases: ["rpcl", "crpl"],
})
export class RecentPassCatchListCommand extends AbstractRecentListCommand {
    protected forcedMode = GameMode.Catch;
    protected forcedPassed = true;
}

// Mania

@Command({
    name: "recentmanialist",
    description: "Shows a list of recent mania plays of an osu! player.",
    prefixOnly: true,
    aliases: ["mrl", "rml"],
})
export class RecentManiaListCommand extends AbstractRecentListCommand {
    protected forcedMode = GameMode.Mania;
    protected forcedPassed = false;
}

@Command({
    name: "recentpassmanialist",
    description: "Shows a list of recent passed mania plays of an osu! player.",
    prefixOnly: true,
    aliases: ["rpml", "mrpl"],
})
export class RecentPassManiaListCommand extends AbstractRecentListCommand {
    protected forcedMode = GameMode.Mania;
    protected forcedPassed = true;
}
