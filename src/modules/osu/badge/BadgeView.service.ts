import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { AbstractViewService } from "@/modules/AbstractViewService";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { Pagination } from "@domain/discord/utils/Pagination";
import { OsekaiBadgeDto, OsekaiBadgeHolderDto } from "@domain/osekai/OsekaiBadge.dto";
import { BadgeViewDto } from "@domain/osu/views/Badge.view";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { AdapterProvider } from "@generated/adapter/types";

export class BadgeViewService extends AbstractViewService<BadgeViewDto> {
    protected readonly ttl: number = 180;

    public build(sessionID: string, data: BadgeViewDto): TMessagePayload {
        const totalPages = data.badges.length || 1;
        const badge = data.badges[data.page - 1];

        if (!badge) {
            throw new Exception(EApplicationError.INTERNAL_ERROR, "Badge was not present during view rendering.");
        }

        const embed = this.embed(badge);

        if (totalPages > 1) {
            embed.setFooter({
                text: `Page ${data.page}/${totalPages}`,
            });
        }

        const components = totalPages > 1 ? [Pagination.build("osu_badge", sessionID, data.page, totalPages)] : [];
        return {
            content: data.content ?? undefined,
            embeds: [embed],
            components,
        };
    }

    private embed(badge: OsekaiBadgeDto): Embed {
        return new Embed()
            .setTitle(badge.description)
            .setURL(badge.url())
            .setThumbnail(badge.imageURL)
            .setFooter({ text: "Osekai" })
            .addFields(
                {
                    name: "Name",
                    value: badge.name,
                },
                {
                    name: "Awarded",
                    value: DateFormatter.full(badge.firstAwardedAt),
                    inline: true,
                },
                {
                    name: "Holders",
                    value: this.holders(badge.holders),
                },
            );
    }

    private holders(holders: ReadonlyArray<OsekaiBadgeHolderDto>): string {
        if (!holders.length) {
            return "None";
        }

        const displayLimit = 14;

        for (let count = Math.min(displayLimit, holders.length); count > 0; count--) {
            const displayed = holders.slice(0, count);
            const hiddenCount = holders.length - displayed.length;

            const list = this.holderList(displayed);

            const suffix = hiddenCount > 0 ? `\n\`...and ${DiscordFormatter.number(hiddenCount)} more\`` : "";
            const result = list + suffix;

            if (result.length <= 1024) {
                return result;
            }
        }

        return DiscordFormatter.quantity(holders.length, "holder");
    }

    private holderList(holders: ReadonlyArray<OsekaiBadgeHolderDto>): string {
        const rowCount = Math.ceil(holders.length / 2);

        const left = holders.slice(0, rowCount);
        const right = holders.slice(rowCount);

        const maxUsernameLength = Math.max(
            ...holders.map((holder) => (holder.username || holder.userID.toString()).length),
        );

        const format = (holder: OsekaiBadgeHolderDto): string => {
            const username = holder.username || holder.userID.toString();
            const flag = holder.countryCode ? DiscordFormatter.countryEmoji(holder.countryCode) : "";

            const profile = DiscordFormatter.link(
                username.padEnd(maxUsernameLength, " "),
                ProfileFormatter.link(AdapterProvider.Bancho, holder.userID),
                null,
                true,
            );

            return `${flag}${profile}`;
        };

        const rows: Array<string> = [];

        for (let i = 0; i < rowCount; i++) {
            const first = left[i];
            const second = right[i];

            if (!first) continue;

            const firstFormatted = format(first);
            rows.push(second ? `${firstFormatted}  ${format(second)}` : firstFormatted);
        }

        return rows.join("\n");
    }
}
