import { Category, Command, Subcommand } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { AbstractRecentCommand } from "./AbstractRecentCommand";
import { GameMode } from "@generated/adapter/types";
import { ECommandCategory } from "@domain/core/Command";

@Command({
    name: "recent",
    description: "The root command for recent subcommands",
    defer: false,
    slashOnly: true,
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

@Command({
    name: "recentscore",
    description: "Shows most recent play of an osu! player.",
    prefixOnly: true,
    aliases: ["rs", "r", "recent"],
})
export class RecentScoreCommand extends AbstractRecentCommand {
    protected forcedPassed = false;
}

@Command({
    name: "recentpass",
    description: "Shows most recent passed play of an osu! player.",
    prefixOnly: true,
    aliases: ["rp"],
})
export class RecentPassCommand extends AbstractRecentCommand {
    protected forcedPassed = true;
}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikorecent",
    description: "Shows most recent play of an osu!taiko player.",
    prefixOnly: true,
    aliases: ["tr", "rt", "recenttaiko"],
})
export class TaikoRecentCommand extends AbstractRecentCommand {
    protected forcedMode = GameMode.Taiko;
    protected forcedPassed = false;
}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikorecentpass",
    description: "Shows most recent passed play of an osu!taiko player.",
    prefixOnly: true,
    aliases: ["rpt", "trp", "recentpasstaiko"],
})
export class TaikoRecentPassCommand extends AbstractRecentCommand {
    protected forcedMode = GameMode.Taiko;
    protected forcedPassed = true;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchrecent",
    description: "Shows most recent play of an osu!catch player.",
    prefixOnly: true,
    aliases: ["cr", "rc", "recentcatch"],
})
export class CatchRecentCommand extends AbstractRecentCommand {
    protected forcedMode = GameMode.Catch;
    protected forcedPassed = false;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchrecentpass",
    description: "Shows most recent passed play of an osu!catch player.",
    prefixOnly: true,
    aliases: ["rpc", "crp", "recentpasscatch"],
})
export class CatchRecentPassCommand extends AbstractRecentCommand {
    protected forcedMode = GameMode.Catch;
    protected forcedPassed = true;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniarecent",
    description: "Shows most recent play of an osu!mania player.",
    prefixOnly: true,
    aliases: ["rm", "recentmania"],
})
export class ManiaRecentCommand extends AbstractRecentCommand {
    protected forcedMode = GameMode.Mania;
    protected forcedPassed = false;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniarecentpass",
    description: "Shows most recent passed play of an osu!mania player.",
    prefixOnly: true,
    aliases: ["rpm", "mrp", "recentpassmania"],
})
export class ManiaRecentPassCommand extends AbstractRecentCommand {
    protected forcedMode = GameMode.Mania;
    protected forcedPassed = true;
}
