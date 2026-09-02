import { AbstractService } from "@/core/framework/AbstractService";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { MatchCostPlayerResultDto, MatchCostTeamScoreDto } from "@domain/osu/MatchCost.dto";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { MatchCostViewDto } from "@domain/osu/views/MatchCost.view";
import { AdapterProvider } from "@generated/adapter/types";
import { EMatchCostTeam } from "@domain/osu/enums/MatchCost.enum";
import { discordEmoteBlueTeam, discordEmoteRedTeam } from "@domain/discord/configs/Emotes.config";
import { MultiplayerFormatter } from "@domain/osu/formatters/Multiplayer.formatter";

export class MatchCostViewService extends AbstractService {
    /**
     * How many players we want to display per team (Team VS) or globally (Head to Head)
     * before cutting.
     */
    private readonly playerDisplayLimit = 10;

    public build(data: MatchCostViewDto): TMessagePayload {
        const embed = new Embed().setTitle(data.name).setURL(MultiplayerFormatter.link(data.type, data.id));

        if (data.calculation.teamVs) {
            this.buildTeamView(embed, data);
        } else {
            this.buildHeadToHeadView(embed, data.calculation.players);
        }

        return {
            content: this.evaluationMessage(data.warmups, data.skip, data.ezMultiplier),
            embeds: [embed],
        };
    }

    private buildTeamView(embed: Embed, data: MatchCostViewDto): void {
        const allPlayers = data.calculation.players;

        const red = allPlayers.filter((player) => player.team === EMatchCostTeam.Red);
        const blue = allPlayers.filter((player) => player.team === EMatchCostTeam.Blue);

        if (data.calculation.teamScore) {
            const label = data.ended ? "Final score" : "Current score";
            embed.setDescription(`**${label}:** ${this.formatTeamScore(data.calculation.teamScore)}`);
        }

        embed.addFields(
            {
                name: `${discordEmoteRedTeam}Red Team`,
                value: this.limitedPlayerList(red, allPlayers),
                inline: false,
            },
            {
                name: `${discordEmoteBlueTeam}Blue Team`,
                value: this.limitedPlayerList(blue, allPlayers),
                inline: false,
            },
        );
    }

    private buildHeadToHeadView(embed: Embed, players: Array<MatchCostPlayerResultDto>): void {
        embed.setDescription(this.limitedPlayerList(players, players));
    }

    private limitedPlayerList(
        players: Array<MatchCostPlayerResultDto>,
        allPlayers: Array<MatchCostPlayerResultDto>,
    ): string {
        const displayed = players.slice(0, this.playerDisplayLimit);
        const hiddenCount = players.length - displayed.length;

        const parts = [
            this.playerList(displayed, allPlayers),
            hiddenCount > 0 ? `\`...and ${hiddenCount} more\`` : null,
        ];
        return parts.filter(Boolean).join("\n");
    }

    private playerList(players: Array<MatchCostPlayerResultDto>, allPlayers: Array<MatchCostPlayerResultDto>): string {
        if (!players.length) {
            return "No players.";
        }

        const maxUsernameLength = Math.max(...allPlayers.map((player) => player.username.length));
        const rankWidth = `#${players.length}`.length;
        const globalRanks = new Map(allPlayers.map((player, index) => [player.userID, index + 1]));

        return players
            .map((player, index) => {
                const localRank = index + 1;
                const globalRank = globalRanks.get(player.userID) ?? 0;

                const rank = `#${localRank}`.padEnd(rankWidth, " ");

                const profile = DiscordFormatter.link(
                    player.username.padEnd(maxUsernameLength, " "),
                    ProfileFormatter.link(AdapterProvider.Bancho, player.userID),
                    null,
                    true,
                );

                const cost = this.formatCost(player.matchCost);
                const medal = this.medal(globalRank, allPlayers.length);

                return `\`${rank}\` ${profile} \`${cost}\`${medal ? ` ${medal}` : ""}`;
            })
            .join("\n");
    }

    private medal(rank: number, playerCount: number): string {
        if (rank === 1) {
            return "🥇";
        }

        if (playerCount >= 4 && rank === 2) {
            return "🥈";
        }

        if (playerCount > 4 && rank === 3) {
            return "🥉";
        }

        return "";
    }

    private formatTeamScore(score: MatchCostTeamScoreDto): string {
        const red = score.red > score.blue ? `**${score.red}**` : score.red.toString();
        const blue = score.blue > score.red ? `**${score.blue}**` : score.blue.toString();
        return `${discordEmoteRedTeam}${red} - ${blue}${discordEmoteBlueTeam}`;
    }

    private formatCost(value: number): string {
        return value.toFixed(2);
    }

    private evaluationMessage(warmups: number, skip: number, ezMultiplier: number): string {
        const exclusions: Array<string> = [];

        if (warmups > 0) {
            exclusions.push(DiscordFormatter.quantity(warmups, "warmup"));
        }

        if (skip > 0) {
            exclusions.push(DiscordFormatter.quantity(skip, "round"));
        }

        const ignored = exclusions.length ? `Ignoring ${exclusions.join(" and ")}. ` : "";
        return `${ignored}EZ multiplier: \`${DiscordFormatter.fixed(ezMultiplier, 2)}x\``;
    }
}
