import { Category, Examples, Help, Import, InjectToken, IsString, Option, Required } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { OsuTrackService } from "@/modules/osutrack/OsuTrack.service";
import { CommandOption, ECommandCategory } from "@domain/core/Command";
import { ECompareProfileView, CompareProfileViewDto } from "@domain/osu/views/CompareProfile.view";
import { scoreBestQueryLimit } from "@domain/osu/configs/Score.config";
import { CompareProfileViewService } from "@/modules/osu/compare/CompareProfileView.service";

@Help(`
    Compares two {mode} player profiles and their top scores.

    If only one username is specified, your linked account is compared
    against that player.

    If two usernames are specified, the second username becomes the
    primary player and the first becomes the opponent.
`)
@Examples("pc mrekk", "pc mrekk WhiteCat", 'pc mrekk "spaced name"')
@Category(ECommandCategory.Osu)
export abstract class AbstractCompareProfileCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly osuTrackService: OsuTrackService;
    @Import() declare private readonly compareProfileViewService: CompareProfileViewService;

    @Option("opponent", "Player to compare against")
    @IsString()
    @InjectToken()
    @Required()
    declare private readonly opponent: CommandOption<string>;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const opponentQuery = await this.resolveExplicitTarget(this.opponent.unwrap(), target.server);

        const [leftResult, rightResult] = await Promise.all([
            this.osuService.userWithScores({
                nameOrID: target.query,
                mode: target.mode,
                type: "best",
                limit: scoreBestQueryLimit,
                provider: target.server,
            }),
            this.osuService.userWithScores({
                nameOrID: opponentQuery,
                mode: target.mode,
                type: "best",
                limit: scoreBestQueryLimit,
                provider: target.server,
            }),
        ]);

        const [leftTrack, rightTrack] = await Promise.all([
            this.osuTrackService.peak(leftResult.user.id, target.mode, target.server).catch(() => null),
            this.osuTrackService.peak(rightResult.user.id, target.mode, target.server).catch(() => null),
        ]);

        const data: CompareProfileViewDto = {
            timestamp: Date.now(),
            origin: ctx.origin(),
            authorID: ctx.author.id,
            left: {
                profile: leftResult.user,
                scores: leftResult.scores,
                mapped: null,
                populated: null,
                osutrack: leftTrack,
            },
            right: {
                profile: rightResult.user,
                scores: rightResult.scores,
                mapped: null,
                populated: null,
                osutrack: rightTrack,
            },
        };

        await this.respondWithSession(
            ctx,
            "osu_profile_compare_view",
            data,
            this.compareProfileViewService,
            ECompareProfileView.Overview,
        );
    }
}
