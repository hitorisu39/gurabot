import { Import } from "@/core/decorators";
import { TMessagePayload } from "@/core/discord/context/MessagePayload";
import { ActionRow } from "@/core/discord/ui/ActionRow";
import { Embed } from "@/core/discord/ui/Embed";
import { SelectMenu } from "@/core/discord/ui/SelectMenu";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { ListScoreView } from "@/modules/osu/scores/ListScoreView.service";
import { discordMaxVisualLineLength } from "@domain/discord/configs/Discord.config";
import { Pagination } from "@domain/discord/utils/Pagination";
import { PopulatedScore } from "@domain/osu/Score.dto";
import { SkillScoreResultDto } from "@domain/osu/Skill.dto";
import { EScoreListSize } from "@domain/osu/enums/Score.enum";
import { ESkillType } from "@domain/osu/enums/Skill.enum";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { ScoreFormatter } from "@domain/osu/formatters/Score.formatter";
import { ScoresViewDto } from "@domain/osu/views/Scores.view";
import { ESkillStatsView, SkillStatsViewDto } from "@domain/osu/views/SkillStats.view";
import { ProfileViewService } from "../profile/ProfileView.service";

interface ISkillScore {
    score: PopulatedScore;
    value: number;
}

export class SkillStatsViewService extends AbstractViewService<SkillStatsViewDto> {
    @Import() declare private readonly profileViewService: ProfileViewService;
    @Import() declare private readonly listScoreView: ListScoreView;

    protected readonly ttl = 180;

    public build(sessionID: string, data: SkillStatsViewDto): TMessagePayload {
        const category = data.categories.find((candidate) => candidate.type === data.view);
        const embed = category ? this.buildSkillView(data, category.type) : this.buildOverview(data);

        const components = [this.buildSelectMenu(sessionID, data)];
        const totalPages = this.getTotalPages(data);

        if (category && totalPages > 1) {
            components.push(Pagination.build("osu_skill_stats", sessionID, data.page, totalPages));
        }

        return {
            embeds: [embed],
            components,
        };
    }

    public getTotalPages(data: SkillStatsViewDto): number {
        if (data.view === ESkillStatsView.Overview) {
            return 1;
        }

        const category = data.categories.find((candidate) => candidate.type === data.view);
        const scoreCount = category?.scoreValues.filter((value) => value !== null).length ?? 0;
        return Math.ceil(scoreCount / this.getPageSize()) || 1;
    }

    private buildOverview(data: SkillStatsViewDto): Embed {
        const embed = this.profileViewService.createBaseEmbed(data.profile, data.timestamp, false);

        const description = data.categories
            .map((category) => {
                return `Average ${category.label.toLowerCase()}: ${MapFormatter.stars(category.average)}`;
            })
            .join("\n");

        embed.setTitle("Skills").setDescription(description);

        for (const category of data.categories) {
            embed.addFields({
                name: `${category.label} skill`,
                value: category.topScores.length
                    ? category.topScores.map((result) => this.formatScore(result)).join("\n")
                    : "No valid scores.",
            });
        }

        return embed;
    }

    private buildSkillView(data: SkillStatsViewDto, skill: ESkillType): Embed {
        const category = data.categories.find((candidate) => candidate.type === skill);
        if (!category) {
            return this.buildOverview(data);
        }

        const skillScores = this.getSkillScores(data, skill);
        const pageSize = this.getPageSize();
        const start = (data.page - 1) * pageSize;
        const page = skillScores.slice(start, start + pageSize);

        const scoreData: ScoresViewDto = {
            timestamp: data.timestamp,
            authorID: data.authorID,
            profile: data.profile,
            scores: skillScores.map((result) => result.score),
            displayQuery: null,
            activeAttributes: [],
            scoreActions: false,
            page: data.page,
            pageSize: EScoreListSize.Detailed,
        };

        return this.listScoreView.render(
            scoreData,
            page.map((result) => result.score),
            {
                extraAttrs: page.map((result) => [`${category.label} skill: ${MapFormatter.stars(result.value)}`]),
            },
        );
    }

    private getSkillScores(data: SkillStatsViewDto, skill: ESkillType): Array<ISkillScore> {
        const category = data.categories.find((candidate) => candidate.type === skill);
        if (!category) {
            return [];
        }

        return category.scoreValues
            .map((value, index): ISkillScore | null => {
                const score = data.scores[index];
                return value === null || !score ? null : { score, value };
            })
            .filter((result): result is ISkillScore => result !== null)
            .sort((a, b) => b.value - a.value);
    }

    private getPageSize(): number {
        return this.listScoreView.getPageSize(EScoreListSize.Detailed);
    }

    private buildSelectMenu(sessionID: string, data: SkillStatsViewDto): ActionRow {
        const menu = new SelectMenu(`osu_skill_stats_select:${sessionID}`)
            .setCurrent(data.view)
            .addChoice("Overview", ESkillStatsView.Overview, "Skill averages and top scores");

        for (const category of data.categories) {
            menu.addChoice(category.label, category.type, `Scores ranked by ${category.label.toLowerCase()} skill`);
        }

        return new ActionRow().add(menu);
    }

    private formatScore(result: SkillScoreResultDto): string {
        const score = result.score;

        const skill = MapFormatter.stars(result.value);
        const grade = ScoreFormatter.grade(score.grade, score.passed, score.id);
        const mods = ScoreFormatter.mods(score.mods);

        const prefixLength = `${skill} ${grade} `.length;
        const suffixLength = mods ? ` ${mods}`.length : 0;
        const maxVisualLength = discordMaxVisualLineLength + 65;
        const headerLimit = Math.max(20, maxVisualLength - prefixLength - suffixLength);

        const header = MapFormatter.header(
            score.beatmapset.artist,
            score.beatmapset.title,
            score.beatmap.version,
            headerLimit,
        );

        const mapLink = `[${header}](${MapFormatter.link(score.beatmap.id)})`;
        const modsDisplay = mods ? ` **${mods}**` : "";

        return `\`${skill}\` ${grade} ${mapLink}${modsDisplay}`;
    }
}
