import { Category, Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { OsuService } from "@/modules/osu/Osu.service";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { EProfileView, ProfileViewDto } from "@domain/osu/views/Profile.view";
import { ECommandCategory } from "@domain/core/Command";
import { OsuTrackService } from "@/modules/osutrack/OsuTrack.service";
import { scoreBestQueryLimit } from "@domain/osu/configs/Score.config";

@Category(ECommandCategory.Osu)
export abstract class AbstractProfileCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly profileViewService: ProfileViewService;
    @Import() declare private readonly osuTrackService: OsuTrackService;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const cachedID = await this.osuService.resolveCachedID(target.query, target.server);

        let user, scores, osutrack;

        if (cachedID) {
            [{ user, scores }, osutrack] = await Promise.all([
                this.osuService.userWithScores({
                    nameOrID: cachedID,
                    mode: target.mode,
                    type: "best",
                    limit: scoreBestQueryLimit,
                    provider: target.server,
                }),
                this.osuTrackService.peak(cachedID, target.mode, target.server).catch(() => null),
            ]);
        } else {
            ({ user, scores } = await this.osuService.userWithScores({
                nameOrID: target.query,
                mode: target.mode,
                type: "best",
                limit: scoreBestQueryLimit,
                provider: target.server,
            }));
            osutrack = await this.osuTrackService.peak(user.id, user.mode, target.server).catch(() => null);
        }

        const data: ProfileViewDto = {
            timestamp: Date.now(),
            origin: ctx.origin(),
            authorID: ctx.author.id,
            profile: user,
            osutrack: osutrack || null,
            scores: null,
            populated: null,
        };

        const { sessionID } = await this.respondWithSession(
            ctx,
            "osu_profile_view",
            data,
            this.profileViewService,
            EProfileView.Overview,
        );

        // Intentionally populate afterwards so we don't make users wait for the response.
        const populated = await this.osuService.populateMaps(scores);
        await this.sessionService.update(
            "osu_profile_view",
            sessionID,
            { scores: populated },
            this.profileViewService.getTtl(),
        );
    }
}
