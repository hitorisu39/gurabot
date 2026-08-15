import { Category, Command } from "@/core/decorators";
import { GameMode } from "@generated/adapter/types";
import { AbstractReachCommand } from "./AbstractReachCommand";
import { ECommandCategory } from "@domain/core/Command";

@Command({
    name: "reach",
    description: "Calculates the plays required to reach another player's pp.",
})
export class ReachCommand extends AbstractReachCommand {}

@Category(ECommandCategory.Taiko)
@Command({
    name: "taikoreach",
    description: "Calculates the plays required to reach another player's osu!taiko pp.",
    aliases: ["reachtaiko", "treach"],
    prefixOnly: true,
})
export class TaikoReachCommand extends AbstractReachCommand {
    protected forcedMode = GameMode.Taiko;
}

@Category(ECommandCategory.Catch)
@Command({
    name: "catchreach",
    description: "Calculates the plays required to reach another player's osu!catch pp.",
    aliases: ["ctbreach", "reachcatch", "creach"],
    prefixOnly: true,
})
export class CatchReachCommand extends AbstractReachCommand {
    protected forcedMode = GameMode.Catch;
}

@Category(ECommandCategory.Mania)
@Command({
    name: "maniareach",
    description: "Calculates the plays required to reach another player's osu!mania pp.",
    aliases: ["reachmania", "mreach"],
    prefixOnly: true,
})
export class ManiaReachCommand extends AbstractReachCommand {
    protected forcedMode = GameMode.Mania;
}
