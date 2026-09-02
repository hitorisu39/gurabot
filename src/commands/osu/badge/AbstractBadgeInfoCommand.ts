import { Autocomplete, Import, Inject, IsString, Option, Required } from "@/core/decorators";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { AutocompleteContext } from "@/core/discord/context/AutocompleteContext";
import { AbstractSessionCommand } from "../../AbstractSessionCommand";
import { OsekaiService } from "@/modules/osekai/Osekai.service";
import { BadgeViewService } from "@/modules/osu/badge/BadgeView.service";
import { CommandOption } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { BadgeViewDto } from "@domain/osu/views/Badge.view";
import { TextFormatter } from "@domain/discord/formatters/Text.formatter";

export abstract class AbstractBadgeInfoCommand extends AbstractSessionCommand {
    @Import() declare private readonly osekaiService: OsekaiService;
    @Import() declare private readonly badgeViewService: BadgeViewService;

    @Option("name", "Specify badge name")
    @IsString(1, 128)
    @Autocomplete()
    @Inject()
    @Required()
    declare private readonly name: CommandOption<string>;

    public async execute(ctx: CommandContext): Promise<void> {
        const query = this.name.unwrap().trim();
        const badges = await this.osekaiService.searchBadge(query);

        if (!badges.length) {
            throw new Exception(EApplicationError.NOT_FOUND, `No badges matching \`${query}\` were found.`);
        }

        const data: BadgeViewDto = {
            authorID: ctx.author.id,
            badges,
            page: 1,
            content: badges.length > 1 ? `Badges matching \`${query}\`:` : null,
        };

        await this.respondWithSession(ctx, "osu_badge_view", data, this.badgeViewService);
    }

    public async autocomplete(ctx: AutocompleteContext): Promise<void> {
        const focused = ctx.getFocused();

        if (focused.name !== "name") {
            return await ctx.respond([]);
        }

        const badges = await this.osekaiService.searchBadge(String(focused.value), 25);

        await ctx.respond(
            badges.map((badge) => {
                const label = `[${TextFormatter.truncate(badge.name, 25)}] ${TextFormatter.truncate(badge.description, 70)}`;
                return {
                    name: label,
                    value: badge.name,
                };
            }),
        );
    }
}
