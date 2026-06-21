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
    name: "rl",
    description: "Shows a list of recent plays of an osu! player.",
    aliases: ["recentlist"],
})
export class RlCommand extends AbstractRecentListCommand {
    protected forcedPassed = false;
}

@Command({
    name: "rpl",
    description: "Shows a list of recent passed plays of an osu! player.",
    aliases: ["recentpasslist"],
})
export class RplCommand extends AbstractRecentListCommand {
    protected forcedPassed = true;
}

@Command({
    name: "trl",
    description: "Shows a list of recent taiko plays of an osu! player.",
    prefixOnly: true,
    aliases: ["rtl"],
})
export class TrlCommand extends AbstractRecentListCommand {
    protected forcedMode = GameMode.Taiko;
    protected forcedPassed = false;
}

@Command({
    name: "rptl",
    description: "Shows a list of recent passed taiko plays of an osu! player.",
    prefixOnly: true,
    aliases: ["trpl"],
})
export class RptlCommand extends AbstractRecentListCommand {
    protected forcedMode = GameMode.Taiko;
    protected forcedPassed = true;
}

@Command({
    name: "crl",
    description: "Shows a list of recent catch plays of an osu! player.",
    prefixOnly: true,
    aliases: ["rcl"],
})
export class CrlCommand extends AbstractRecentListCommand {
    protected forcedMode = GameMode.Catch;
    protected forcedPassed = false;
}

@Command({
    name: "rpcl",
    description: "Shows a list of recent passed catch plays of an osu! player.",
    prefixOnly: true,
    aliases: ["crpl"],
})
export class RpclCommand extends AbstractRecentListCommand {
    protected forcedMode = GameMode.Catch;
    protected forcedPassed = true;
}

@Command({
    name: "mrl",
    description: "Shows a list of recent mania plays of an osu! player.",
    prefixOnly: true,
    aliases: ["rml"],
})
export class MrlCommand extends AbstractRecentListCommand {
    protected forcedMode = GameMode.Mania;
    protected forcedPassed = false;
}

@Command({
    name: "rpml",
    description: "Shows a list of recent passed mania plays of an osu! player.",
    prefixOnly: true,
    aliases: ["mrpl"],
})
export class RpmlCommand extends AbstractRecentListCommand {
    protected forcedMode = GameMode.Mania;
    protected forcedPassed = true;
}
