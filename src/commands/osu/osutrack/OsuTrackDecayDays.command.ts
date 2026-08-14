import { Category, Command, Subcommand } from "@/core/decorators";
import { ECommandCategory } from "@domain/core/Command";
import { GameMode } from "@generated/adapter/types";
import { AbstractOsuTrackDecayDaysCommand } from "./AbstractOsuTrackDecayDaysCommand";

@Subcommand({
    root: "osutrack",
    group: "decay",
    name: "days",
    description: "Estimates rank decay after a specified number of days.",
})
export class OsuTrackDecayDaysSubcommand extends AbstractOsuTrackDecayDaysCommand {}

@Command({
    name: "osutrackdecaydays",
    description: "Estimates rank decay after a specified number of days.",
    aliases: ["otdd"],
    prefixOnly: true,
})
export class OsuTrackDecayDaysCommand extends AbstractOsuTrackDecayDaysCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikoosutrackdecaydays",
    description: "Estimates osu!taiko rank decay after a specified number of days.",
    aliases: ["totdd"],
    prefixOnly: true,
})
export class TaikoOsuTrackDecayDaysCommand extends AbstractOsuTrackDecayDaysCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchosutrackdecaydays",
    description: "Estimates osu!catch rank decay after a specified number of days.",
    aliases: ["cotdd"],
    prefixOnly: true,
})
export class CatchOsuTrackDecayDaysCommand extends AbstractOsuTrackDecayDaysCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniaosutrackdecaydays",
    description: "Estimates osu!mania rank decay after a specified number of days.",
    aliases: ["motdd"],
    prefixOnly: true,
})
export class ManiaOsuTrackDecayDaysCommand extends AbstractOsuTrackDecayDaysCommand {
    protected forcedMode = GameMode.Mania;
}
