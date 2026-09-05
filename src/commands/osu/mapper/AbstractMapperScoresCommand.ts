import { Category, Import, InjectToken, IsEnum, IsString, Option, Required } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AbstractOsuCommand } from "../AbstractOsuCommand";
import { OsuService } from "@/modules/osu/Osu.service";
import { ScoreViewService } from "@/modules/osu/scores/ScoreView.service";
import { CommandOption, ECommandCategory } from "@domain/core/Command";
import { EScoreListSize } from "@domain/osu/enums/Score.enum";
import { ScoresViewDto } from "@domain/osu/views/Scores.view";
import { TextFormatter } from "@domain/discord/formatters/Text.formatter";

@Category(ECommandCategory.Osu)
export abstract class AbstractMapperScoresCommand extends AbstractOsuCommand {
    @Import() declare private readonly osuService: OsuService;
    @Import() declare private readonly scoreViewService: ScoreViewService;

    @Option("mapper", "Show scores played on maps by this mapper")
    @IsString()
    @InjectToken()
    @Required()
    declare private readonly mapper: CommandOption<string>;

    @Option("size", "Format in which the scores will be displayed")
    @IsEnum(EScoreListSize)
    declare private readonly size: CommandOption<EScoreListSize>;

    protected abstract readonly scoreType: "best" | "pinned";
    protected abstract readonly scoreLimit: number;

    public async execute(ctx: CommandContext): Promise<void> {
        const target = await this.resolveTarget(ctx);

        const [guildConfig, userConfig, mapper, { user, scores }] = await Promise.all([
            ctx.guild ? this.guildService.get(ctx.guild.id) : null,
            this.userService.get(ctx.author.id),
            this.osuService.user(this.mapper.unwrap(), target.mode, target.server),
            this.osuService.userWithScores({
                nameOrID: target.query,
                mode: target.mode,
                type: this.scoreType,
                limit: this.scoreLimit,
                provider: target.server,
            }),
        ]);

        const sizeOption = this.size.unwrapOr(
            userConfig?.scoreListSize ?? guildConfig?.scoreListSize ?? EScoreListSize.Detailed,
        );

        const populatedScores = await this.osuService.populateMaps(scores);
        const mapperScores = populatedScores.filter((score) =>
            score.beatmap.owners.some((owner) => owner.id === mapper.id),
        );

        const sourceDescription =
            this.scoreType === "best" ? `top ${scores.length} scores` : `${scores.length} pinned scores`;

        const data: ScoresViewDto = {
            timestamp: Date.now(),
            authorID: ctx.author.id,
            profile: user,
            scores: mapperScores,
            displayQuery:
                `**${mapperScores.length}** of ${TextFormatter.possessive(user.username, true)} ${sourceDescription} ` +
                `are on maps by \`${mapper.username}\`:`,
            activeAttributes: [],
            scoreActions: target.scoreActions,
            pageSize: sizeOption,
            page: 1,
        };

        if (this.scoreType === "best") {
            await this.scoreViewService.prepare(data, { personalScores: scores });
        } else {
            await this.scoreViewService.prepare(data);
        }

        await this.respondWithSession(ctx, "osu_scores_view", data, this.scoreViewService);
    }
}
