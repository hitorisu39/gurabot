import { scoreBestQueryLimit } from "@domain/osu/configs/Score.config";
import { AbstractMapperScoresCommand } from "./AbstractMapperScoresCommand";

export abstract class AbstractMapperTopCommand extends AbstractMapperScoresCommand {
    protected readonly scoreType = "best";
    protected readonly scoreLimit = scoreBestQueryLimit;
}
