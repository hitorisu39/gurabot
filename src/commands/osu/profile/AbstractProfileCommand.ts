import { Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { OsuService } from "@/modules/osu/Osu.service";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { EProfileView, ProfileViewDto } from "@domain/osu/views/Profile.view";
import { AmeobeaService } from "@/modules/ameobea/Ameobea.service";

export abstract class AbstractProfileCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly profileViewService: ProfileViewService;
    @Import() declare private readonly ameobeaService: AmeobeaService;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const cachedID = await this.osuService.resolveCachedID(target.query, target.server);

        let user, scores, ameobea;

        if (cachedID) {
            [{ user, scores }, ameobea] = await Promise.all([
                this.osuService.userWithScores({
                    nameOrID: cachedID,
                    mode: target.mode,
                    type: "best",
                    limit: 100,
                    provider: target.server,
                }),
                this.ameobeaService.peak(cachedID, target.mode, target.server).catch(() => null),
            ]);
        } else {
            ({ user, scores } = await this.osuService.userWithScores({
                nameOrID: target.query,
                mode: target.mode,
                type: "best",
                limit: 100,
                provider: target.server,
            }));
            ameobea = await this.ameobeaService.peak(user.id, user.mode, target.server).catch(() => null);
        }

        const data: ProfileViewDto = {
            timestamp: Date.now(),
            origin: ctx.origin(),
            authorID: ctx.author.id,
            profile: user,
            ameobea: ameobea || null,
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
