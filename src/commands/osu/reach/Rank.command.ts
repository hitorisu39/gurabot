import { Category, Command } from "@/core/decorators";
import { GameMode } from "@generated/adapter/types";
import { AbstractRankCommand } from "./AbstractRankCommand";
import { ECommandCategory } from "@domain/core/Command";

@Command({
    name: "rank",
    description: "Calculates the plays required to reach a target rank.",
})
export class RankCommand extends AbstractRankCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikorank",
    description: "Calculates the plays required to reach a target osu!taiko rank.",
    aliases: ["ranktaiko", "trank"],
    prefixOnly: true,
})
export class TaikoRankCommand extends AbstractRankCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchrank",
    description: "Calculates the plays required to reach a target osu!catch rank.",
    aliases: ["ctbrank", "rankcatch", "crank"],
    prefixOnly: true,
})
export class CatchRankCommand extends AbstractRankCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniarank",
    description: "Calculates the plays required to reach a target osu!mania rank.",
    aliases: ["rankmania", "mrank"],
    prefixOnly: true,
})
export class ManiaRankCommand extends AbstractRankCommand {
    protected forcedMode = GameMode.Mania;
}
