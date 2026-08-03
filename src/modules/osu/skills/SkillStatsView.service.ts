import { Import } from "@/core/decorators";
import { Embed } from "@/core/discord/ui/Embed";
import { AbstractService } from "@/core/framework/AbstractService";
import { SkillScoreResultDto } from "@domain/osu/Skill.dto";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { ScoreFormatter } from "@domain/osu/formatters/Score.formatter";
import { SkillStatsViewDto } from "@domain/osu/views/SkillStats.view";
import { ProfileViewService } from "../profile/ProfileView.service";
import { discordMaxVisualLineLength } from "@domain/discord/configs/Discord.config";

export class SkillStatsViewService extends AbstractService {
    @Import()
    declare private readonly profileViewService: ProfileViewService;

    public build(data: SkillStatsViewDto): Embed {
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
