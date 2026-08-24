import { SnipePlayerChangesViewDto } from "@domain/snipe/views/SnipePlayerChanges.view";
import { AbstractViewService } from "../AbstractViewService";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { snipePlayerChangesPageSize } from "@domain/snipe/configs/Snipe.config";
import { ESnipePlayerChangeType } from "@domain/snipe/enums/Snipe.enum";
import { MapFormatter } from "@domain/osu/formatters/Map.formatter";
import { SnipeRecentDto } from "@domain/snipe/SnipeRecent.dto";
import { Pagination } from "@domain/discord/utils/Pagination";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { discordMaxVisualLineLength } from "@domain/discord/configs/Discord.config";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { scoreStatsCompactDelimiter } from "@domain/osu/configs/Score.config";
import { Import } from "@/core/decorators";
import { ProfileViewService } from "../osu/profile/ProfileView.service";

export class SnipePlayerChangesViewService extends AbstractViewService<SnipePlayerChangesViewDto> {
    @Import() declare private readonly profileViewService: ProfileViewService;

    protected readonly ttl = 180;

    public build(sessionID: string, data: SnipePlayerChangesViewDto): TMessagePayload {
        const totalPages = Math.max(1, Math.ceil(data.changes.length / snipePlayerChangesPageSize));
        const offset = (data.page - 1) * snipePlayerChangesPageSize;

        const changes = data.changes.slice(offset, offset + snipePlayerChangesPageSize);
        const description = changes
            .map((change, index) => this.formatChange(change, offset + index + 1, data.type))
            .join("\n");

        const verb = data.type === ESnipePlayerChangeType.Gain ? "gained" : "lost";
        const embed = this.profileViewService
            .createBaseEmbed(data.profile, data.timestamp, false)
            .setDescription(description);

        return {
            content:
                `\`${data.profile.username}\` ${verb} ` +
                `${DiscordFormatter.number(data.changes.length)} ` +
                `national #1${data.changes.length === 1 ? "" : "s"} ` +
                `in the last ${data.days} days:`,
            embeds: [embed],
            components:
                totalPages > 1 ? [Pagination.build("snipe_player_changes", sessionID, data.page, totalPages)] : [],
        };
    }

    private formatChange(change: SnipeRecentDto, index: number, type: ESnipePlayerChangeType): string {
        const mods = change.mods && change.mods !== "NM" ? ` +${change.mods}` : "";

        const prefixLength = `${index}\\. `.length;
        const suffixLength = mods.length;
        const headerLimit = Math.max(20, discordMaxVisualLineLength - prefixLength - suffixLength);

        const header = MapFormatter.header(change.artist, change.title, change.version, headerLimit);
        const firstLine = `**${index}\\. [${header}](${MapFormatter.link(change.mapID)})${mods}**`;

        const details: Array<string> = [];
        const pp = change.pp === null ? "-pp" : `${DiscordFormatter.fixed(change.pp, 2)}pp`;

        details.push(`**${pp}**`);
        details.push(`${DiscordFormatter.fixed(change.accuracy, 2)}%`);

        if (change.stars !== null) {
            details.push(`${DiscordFormatter.fixed(change.stars, 2)}★`);
        }

        if (change.date) {
            details.push(DateFormatter.discord(change.date, "R"));
        }

        const opponent = type === ESnipePlayerChangeType.Gain ? change.snipedUsername : change.sniperUsername;
        if (opponent) {
            details.push(type === ESnipePlayerChangeType.Gain ? `sniped \`${opponent}\`` : `sniped by \`${opponent}\``);
        }

        return `${firstLine}\n${details.join(scoreStatsCompactDelimiter)}`;
    }
}
