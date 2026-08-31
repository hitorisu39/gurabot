import { Import, Trace } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { OsuService } from "@/modules/osu/Osu.service";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { EScorepostClient } from "@domain/osu/enums/Scorepost.enum";
import { ScorepostViewDto } from "@domain/osu/views/Scorepost.view";
import { GameMode, User } from "@generated/adapter/types";

export class ScorepostService extends AbstractService {
    @Import() declare private readonly osuService: OsuService;

    @Trace()
    public async resolve(
        scoreID: string,
        ur?: number | null,
        text?: string | null,
        timezoneOffset = 0,
    ): Promise<ScorepostViewDto> {
        const rawScore = await this.osuService.score(scoreID);

        const mode = rawScore.mode ?? GameMode.Standard;
        const populatedScores = await this.osuService.populateAll([rawScore], mode);
        const populatedScore = populatedScores[0];

        if (!populatedScore) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                `Could not populate beatmap information for score ${scoreID}.`,
            );
        }

        const placedScores = await this.osuService.populateScorePlacements({
            scores: [populatedScore],
            userID: populatedScore.userID,
            mode: mode,
            beatmap: populatedScore.beatmap,
        });

        const score = placedScores[0];
        if (!score) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                `Could not populate placement information for score ${scoreID}.`,
            );
        }

        const user: User = score.user ?? (await this.osuService.user(score.userID, GameMode.Standard));
        const client = !score.legacyTotalScore ? EScorepostClient.Lazer : EScorepostClient.Stable;

        return {
            score,
            user,
            client,
            ur,
            text,
            timezoneOffset,
        };
    }
}
