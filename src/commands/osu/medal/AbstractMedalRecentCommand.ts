import { Import } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { MedalRecentEntryDto, MedalRecentViewDto } from "@domain/osu/views/MedalRecent.view";
import { AdapterProvider } from "@generated/adapter/types";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { MedalRecentViewService } from "@/modules/osu/medal/MedalRecentView.service";
import { OsekaiService } from "@/modules/osekai/Osekai.service";

export abstract class AbstractMedalRecentCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly osekaiService: OsekaiService;
    @Import() declare private readonly medalRecentViewService: MedalRecentViewService;

    protected forcedServer = AdapterProvider.Bancho;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);

        const [profile, osekaiMedals, guild] = await Promise.all([
            this.osuService.user(target.query, target.mode, target.server),
            this.osekaiService.medals(),
            ctx.guild ? this.guildService.get(ctx.guild.id) : Promise.resolve(null),
        ]);

        const medalsByID = new Map(osekaiMedals.map((medal) => [medal.id, medal]));
        const medals = (profile.achievements ?? [])
            .map((achievement): MedalRecentEntryDto | null => {
                const medal = medalsByID.get(achievement.achievementID);

                if (!medal) {
                    return null;
                }

                return {
                    medal,
                    achievedAt: achievement.achievedAt,
                };
            })
            .filter((entry): entry is MedalRecentEntryDto => entry !== null)
            .sort((a, b) => b.achievedAt.getTime() - a.achievedAt.getTime());

        if (!medals.length) {
            throw new Exception(EApplicationError.NOT_FOUND, `No medals were found for \`${profile.username}\`.`);
        }

        const data: MedalRecentViewDto = {
            timestamp: Date.now(),
            authorID: ctx.author.id,
            profile,
            medals,
            page: 1,
            spoil: guild?.spoilMedals ?? true,
        };

        await this.respondWithSession(ctx, "osu_medal_recent_view", data, this.medalRecentViewService);
    }
}
