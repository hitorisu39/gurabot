import { AbstractService } from "@/core/framework/AbstractService";
import { TMessagePayload } from "@/core/discord/context/MessagePayload";
import { DiscordFormatter } from "@domain/discord/formatters/Discord.formatter";
import { PopulatedUser } from "@domain/osu/Profile.dto";
import { OtrProfileFormatter } from "@domain/otr/formatters/OtrProfile.formatter";
import { OtrPlayerStatsDto } from "@domain/otr/OtrPlayer.dto";
import { OtrPlayerAttributesCalculator } from "@domain/otr/utils/OtrPlayerAttributesCalculator";
import { Import } from "@/core/decorators";
import { OtrProfileViewService } from "./OtrProfileView.service";

export class OtrHistoryViewService extends AbstractService {
    @Import() declare profileViewService: OtrProfileViewService;

    private readonly filename = "otr-rating-history.png";

    public build(profile: PopulatedUser, stats: OtrPlayerStatsDto, graph: Buffer): TMessagePayload {
        const history = OtrPlayerAttributesCalculator.ratingHistory(stats.rating?.adjustments ?? []);

        const embed = this.profileViewService.createBaseEmbed(profile, stats).setImage(`attachment://${this.filename}`);

        if (history) {
            embed.addFields(
                {
                    name: "Current",
                    value: OtrProfileFormatter.rating(history.current),
                    inline: true,
                },
                {
                    name: "Peak",
                    value: OtrProfileFormatter.rating(history.peak),
                    inline: true,
                },
                {
                    name: "Change",
                    value: DiscordFormatter.delta(DiscordFormatter.fixed(history.change)),
                    inline: true,
                },
                {
                    name: "Best Gain",
                    value: DiscordFormatter.delta(DiscordFormatter.fixed(history.largestGain)),
                    inline: true,
                },
                {
                    name: "Worst Loss",
                    value: DiscordFormatter.delta(DiscordFormatter.fixed(history.largestLoss)),
                    inline: true,
                },
            );
        }

        return {
            embeds: [embed],
            files: [
                {
                    attachment: graph,
                    name: this.filename,
                },
            ],
        };
    }
}
