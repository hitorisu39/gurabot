import { AbstractService } from "@/core/framework/AbstractService";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { EmbedBuilder } from "discord.js";
import { UsernameAvailabilityDto } from "@domain/osu/UsernameAvailability.dto";
import {
    EUsernameAvailabilityStatus,
    EUsernameProtectionReason,
    EUsernameValidationIssue,
} from "@domain/osu/enums/UsernameAvailability.enum";
import { DateFormatter } from "@domain/discord/formatters/Date.formatter";
import { discordEmbedColorGeneral } from "@domain/discord/configs/Embed.config";

export class UsernameAvailabilityViewService extends AbstractService {
    public build(data: UsernameAvailabilityDto): TMessagePayload {
        const embed = new EmbedBuilder()
            .setColor(discordEmbedColorGeneral)
            .setTitle(`Is ${data.username} available?`)
            .setDescription(this.description(data));

        if (data.status === EUsernameAvailabilityStatus.Available) {
            embed.setFooter({
                text: "osu! may still reject inappropriate or internally protected usernames.",
            });
        }

        return {
            embeds: [embed],
        };
    }

    private description(data: UsernameAvailabilityDto): string {
        const name = `\`${data.username}\``;

        switch (data.status) {
            case EUsernameAvailabilityStatus.Invalid:
                return `${name} isn't a valid osu! username: ` + `${this.validationIssues(data.validationIssues)}.`;
            case EUsernameAvailabilityStatus.Protected:
                return (
                    `${name} is used by a player who ` +
                    `${this.protectionReasons(data.protectionReasons)}, ` +
                    `so the username is likely protected.`
                );
            case EUsernameAvailabilityStatus.AvailableLater:
                return this.availableLater(data);
            case EUsernameAvailabilityStatus.Unknown:
                return this.unknownAvailability(data);
            case EUsernameAvailabilityStatus.Available: {
                return data.user
                    ? `${name} appears to be available under osu!'s inactivity rules.`
                    : `${name} appears to be available.`;
            }
        }
    }

    private availableLater(data: UsernameAvailabilityDto): string {
        if (!data.availableAt) {
            return `\`${data.username}\` is currently unavailable.`;
        }

        return (
            `\`${data.username}\` is expected to become available ` + `${DateFormatter.discord(data.availableAt, "R")}.`
        );
    }

    private unknownAvailability(data: UsernameAvailabilityDto): string {
        const name = `\`${data.username}\``;

        if (!data.availableIfInactiveFromNow) {
            return (
                `${name} is currently in use, but their last visit isn't available publicly, ` +
                `so its availability can't be estimated.`
            );
        }

        return (
            `${name} is currently in use, but their last visit isn't available publicly. ` +
            `If they stopped playing now, the username would become available ` +
            `${DateFormatter.discord(data.availableIfInactiveFromNow, "R")}.`
        );
    }

    private protectionReasons(reasons: ReadonlyArray<EUsernameProtectionReason>): string {
        const values = reasons.map((reason) => {
            switch (reason) {
                case EUsernameProtectionReason.Top100:
                    return "reached the global top 100";
                case EUsernameProtectionReason.Badges:
                    return "has profile badges";
                case EUsernameProtectionReason.Beatmaps:
                    return "has leaderboard-enabled beatmaps";
            }
        });

        return this.join(values);
    }

    private validationIssues(issues: ReadonlyArray<EUsernameValidationIssue>): string {
        const values = issues.map((issue) => {
            switch (issue) {
                case EUsernameValidationIssue.LeadingOrTrailingSpaces:
                    return "it can't start or end with spaces";
                case EUsernameValidationIssue.TooShort:
                    return "it must be at least 3 characters long";
                case EUsernameValidationIssue.TooLong:
                    return "it must be at most 15 characters long";
                case EUsernameValidationIssue.InvalidCharacters:
                    return "it contains unsupported characters";
                case EUsernameValidationIssue.ConsecutiveSpaces:
                    return "it can't contain consecutive spaces";
                case EUsernameValidationIssue.MixedSpacesAndUnderscores:
                    return "spaces and underscores can't be used together";
            }
        });

        return this.join(values);
    }

    private join(values: ReadonlyArray<string>): string {
        if (values.length <= 1) {
            return values[0] ?? "";
        }

        if (values.length === 2) {
            return `${values[0]} and ${values[1]}`;
        }

        return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
    }
}
