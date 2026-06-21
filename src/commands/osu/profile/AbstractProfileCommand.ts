import { Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { OsuService } from "@/modules/osu/Osu.service";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { ProfileViewService } from "@/modules/osu/profile/ProfileView.service";
import { SessionService } from "@/modules/cache/Session.service";
import { EProfileView, ProfileViewDto } from "@domain/osu/views/Profile.view";
import { AmeobeaService } from "@/modules/ameobea/Ameobea.service";

export abstract class AbstractProfileCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly profileViewService: ProfileViewService;
    @Import() declare private readonly sessionService: SessionService;
    @Import() declare private readonly ameobeaService: AmeobeaService;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const cachedID = await this.osuService.resolveCachedID(target.query);

        let user, scores, ameobea;

        if (cachedID) {
            [{ user, scores }, ameobea] = await Promise.all([
                this.osuService.userWithScores({ nameOrID: cachedID, mode: target.mode, type: "best", limit: 100 }),
                this.ameobeaService.peak(cachedID, target.mode, target.server).catch(() => null),
            ]);
        } else {
            ({ user, scores } = await this.osuService.userWithScores({
                nameOrID: target.query,
                mode: target.mode,
                type: "best",
                limit: 100,
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

        const ttl = this.profileViewService.getTtl();
        const sessionID = await this.sessionService.create("osu_profile_view", data, ttl);

        const view = this.profileViewService.build(sessionID, data, EProfileView.Overview);
        const message = await ctx.respond(view);
        this.sessionService.after(sessionID, () => message?.edit({ components: [] }));

        const populated = await this.osuService.populateMaps(scores);
        await this.sessionService.update("osu_profile_view", sessionID, { scores: populated }, ttl);
    }
}
