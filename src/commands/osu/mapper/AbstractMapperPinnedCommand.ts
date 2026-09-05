import { scorePinnedQueryLimit } from "@domain/osu/configs/Score.config";
import { AbstractMapperScoresCommand } from "./AbstractMapperScoresCommand";

export abstract class AbstractMapperPinnedCommand extends AbstractMapperScoresCommand {
    protected readonly scoreType = "pinned";
    protected readonly scoreLimit = scorePinnedQueryLimit;
}
