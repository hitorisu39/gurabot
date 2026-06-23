import { Command, Subcommand } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { AbstractRecentCommand } from "./AbstractRecentCommand";
import { GameMode } from "@generated/adapter/types";

@Command({
    name: "recent",
    description: "The root command for recent subcommands",
    defer: false,
})
export class RecentRootCommand extends AbstractCommand {
    public async execute(): Promise<void> {
        return;
    }
}

@Subcommand({
    root: "recent",
    name: "score",
    description: "Shows most recent play of an osu! player.",
})
export class RecentScoreSubcommand extends AbstractRecentCommand {
    protected forcedPassed = false;
}

@Subcommand({
    root: "recent",
    name: "pass",
    description: "Shows most recent passed play of an osu! player.",
})
export class RecentPassSubcommand extends AbstractRecentCommand {
    protected forcedPassed = true;
}

// Standard

@Command({
    name: "recentscore",
    description: "Shows most recent play of an osu! player.",
    aliases: ["rs", "r"],
})
export class RecentScoreCommand extends AbstractRecentCommand {
    protected forcedPassed = false;
}

@Command({
    name: "recentpass",
    description: "Shows most recent passed play of an osu! player.",
    aliases: ["rp"],
})
export class RecentPassCommand extends AbstractRecentCommand {
    protected forcedPassed = true;
}

// Taiko

@Command({
    name: "recenttaiko",
    description: "Shows most recent play of an osu!taiko player.",
    prefixOnly: true,
    aliases: ["tr", "rt"],
})
export class RecentTaikoCommand extends AbstractRecentCommand {
    protected forcedMode = GameMode.Taiko;
    protected forcedPassed = false;
}

@Command({
    name: "recentpasstaiko",
    description: "Shows most recent passed play of an osu!taiko player.",
    prefixOnly: true,
    aliases: ["rpt", "trp"],
})
export class RecentPassTaikoCommand extends AbstractRecentCommand {
    protected forcedMode = GameMode.Taiko;
    protected forcedPassed = true;
}

// Catch

@Command({
    name: "recentcatch",
    description: "Shows most recent play of an osu!catch player.",
    prefixOnly: true,
    aliases: ["cr", "rc"],
})
export class RecentCatchCommand extends AbstractRecentCommand {
    protected forcedMode = GameMode.Catch;
    protected forcedPassed = false;
}

@Command({
    name: "recentpasscatch",
    description: "Shows most recent passed play of an osu!catch player.",
    prefixOnly: true,
    aliases: ["rpc", "crp"],
})
export class RecentPassCatchCommand extends AbstractRecentCommand {
    protected forcedMode = GameMode.Catch;
    protected forcedPassed = true;
}

// Mania

@Command({
    name: "recentmania",
    description: "Shows most recent play of an osu!mania player.",
    prefixOnly: true,
    aliases: ["mr", "rm"],
})
export class RecentManiaCommand extends AbstractRecentCommand {
    protected forcedMode = GameMode.Mania;
    protected forcedPassed = false;
}

@Command({
    name: "recentpassmania",
    description: "Shows most recent passed play of an osu!mania player.",
    prefixOnly: true,
    aliases: ["rpm", "mrp"],
})
export class RecentPassManiaCommand extends AbstractRecentCommand {
    protected forcedMode = GameMode.Mania;
    protected forcedPassed = true;
}