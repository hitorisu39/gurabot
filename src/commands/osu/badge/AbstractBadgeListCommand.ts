import { Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { OsekaiService } from "@/modules/osekai/Osekai.service";
import { BadgeViewService } from "@/modules/osu/badge/BadgeView.service";
import { AdapterProvider } from "@generated/adapter/types";
import { BadgeViewDto } from "@domain/osu/views/Badge.view";
import { TextFormatter } from "@domain/discord/formatters/Text.formatter";

export abstract class AbstractBadgeListCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly osekaiService: OsekaiService;
    @Import() declare private readonly badgeViewService: BadgeViewService;

    protected forcedServer = AdapterProvider.Bancho;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);
        const [profile, allBadges] = await Promise.all([
            this.osuService.user(target.query, target.mode, target.server),
            this.osekaiService.badges(),
        ]);

        const badges = allBadges
            .filter((badge) => badge.holders.some((holder) => holder.userID === profile.id))
            .sort((a, b) => b.firstAwardedAt.getTime() - a.firstAwardedAt.getTime() || a.name.localeCompare(b.name));

        if (!badges.length) {
            await ctx.respond({
                content: `No badges were found for **${profile.username}**.`,
            });

            return;
        }

        const data: BadgeViewDto = {
            authorID: ctx.author.id,
            badges,
            page: 1,
            content: `${TextFormatter.possessive(profile.username, true)} badges:`,
        };

        await this.respondWithSession(ctx, "osu_badge_view", data, this.badgeViewService);
    }
}
