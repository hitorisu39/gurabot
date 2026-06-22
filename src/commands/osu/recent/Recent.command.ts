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

@Command({
    name: "rs",
    description: "Shows most recent play of an osu! player.",
    aliases: ["r"],
})
export class RsCommand extends AbstractRecentCommand {
    protected forcedPassed = false;
}

@Command({
    name: "rp",
    description: "Shows most recent passed play of an osu! player.",
    aliases: ["recentpass"],
})
export class RpCommand extends AbstractRecentCommand {
    protected forcedPassed = true;
}

@Command({ name: "tr", description: "Shows most recent play of an osu!taiko player.", prefixOnly: true, aliases: ["rt"] })
export class TrCommand extends AbstractRecentCommand {
    protected forcedMode = GameMode.Taiko;
    protected forcedPassed = false;
}

@Command({ name: "rpt", description: "Shows most recent passed play of an osu!taiko player.", prefixOnly: true, aliases: ["trp"] })
export class RptCommand extends AbstractRecentCommand {
    protected forcedMode = GameMode.Taiko;
    protected forcedPassed = true;
}

@Command({ name: "cr", description: "Shows most recent play of an osu!catch player.", prefixOnly: true, aliases: ["rc"] })
export class CrCommand extends AbstractRecentCommand {
    protected forcedMode = GameMode.Catch;
    protected forcedPassed = false;
}

@Command({ name: "rpc", description: "Shows most recent passed play of an osu!catch player.", prefixOnly: true, aliases: ["crp"] })
export class RpcCommand extends AbstractRecentCommand {
    protected forcedMode = GameMode.Catch;
    protected forcedPassed = true;
}

@Command({ name: "mr", description: "Shows most recent play of an osu!mania player.", prefixOnly: true, aliases: ["rm"] })
export class MrCommand extends AbstractRecentCommand {
    protected forcedMode = GameMode.Mania;
    protected forcedPassed = false;
}

@Command({ name: "rpm", description: "Shows most recent passed play of an osu!mania player.", prefixOnly: true, aliases: ["mrp"] })
export class RpmCommand extends AbstractRecentCommand {
    protected forcedMode = GameMode.Mania;
    protected forcedPassed = true;
}